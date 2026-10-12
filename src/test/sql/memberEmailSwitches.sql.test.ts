// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Runs the real migrations on an in-process Postgres (PGlite). The harness has
// no sign-in dates, donations or donation accounts, so add minimal copies.
const EXTRAS = `
  ALTER TABLE auth.users ADD COLUMN last_sign_in_at timestamptz, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  CREATE TABLE public.donations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_email text, created_by uuid,
    status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.donation_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_active boolean NOT NULL DEFAULT true);
`
const MIGRATIONS = [
  '20261012090000_premium_invite_email.sql',
  '20261012120000_support_appeal_email.sql',
  '20261013120000_member_email_switches.sql',
]

let db: Db
let admin: string

const count = async (fn: string) => (await db.query(`SELECT * FROM public.${fn}()`)).rows.length

/** Run a query as a signed-in member or admin. */
async function asUser<T>(user: string, sql: string, params: unknown[] = []) {
  await db.as(user)
  try {
    return await db.asRole('authenticated', () => db.one<T>(sql, params))
  } finally {
    await db.as(null)
  }
}
const setSwitch = (user: string, key: string, enabled: boolean) =>
  asUser(user, `SELECT public.admin_set_member_email($1, $2)`, [key, enabled])
const status = async (user: string) =>
  (await asUser<{ s: Record<string, { enabled: boolean; sent_30d: number; unsubscribed: number }> }>(
    user,
    `SELECT public.admin_member_email_status() AS s`,
  )).s

/** A member who qualifies for both emails. */
async function member() {
  const id = await db.addUser()
  await db.query(`UPDATE public.profiles SET email = $1 WHERE id = $2`, [`${id}@example.com`, id])
  await db.query(
    `UPDATE auth.users SET last_sign_in_at = now() - interval '2 days', created_at = now() - interval '60 days' WHERE id = $1`,
    [id],
  )
  await db.query(`INSERT INTO public.monetization_events (user_id, event) VALUES ($1, 'LIKE_LIMIT_REACHED')`, [id])
  return id
}

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(EXTRAS)
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations', file), 'utf8'))
  }
  admin = await db.addUser({ admin: true })
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.premium_invites;
    DELETE FROM public.support_appeals;
    DELETE FROM public.monetization_events;
    UPDATE auth.users SET last_sign_in_at = NULL;
    UPDATE public.member_email_settings SET enabled = true;
    UPDATE public.payment_providers SET is_enabled = (provider = 'paystack');
    UPDATE public.subscription_plans SET is_active = true, is_visible = true WHERE code = 'premium_monthly';
  `)
})

describe('on/off switches for member emails', () => {
  it('starts with both emails on, and they still pick members', async () => {
    await member()
    expect(await status(admin)).toMatchObject({ premium_invite: { enabled: true }, support_appeal: { enabled: true } })
    expect(await count('premium_invite_claim')).toBe(1)
    expect(await count('support_appeal_claim')).toBe(1)
  })

  it('stops one email without touching the other, and resumes with nobody lost', async () => {
    await member()
    await setSwitch(admin, 'premium_invite', false)
    expect(await count('premium_invite_claim')).toBe(0)
    expect(await count('support_appeal_claim')).toBe(1)
    expect((await status(admin)).premium_invite.enabled).toBe(false)

    await setSwitch(admin, 'premium_invite', true)
    expect(await count('premium_invite_claim')).toBe(1)
  })

  it('reports how many were sent and how many unsubscribed', async () => {
    await member()
    await member()
    await count('support_appeal_claim')
    await db.query(
      `UPDATE public.support_appeals SET opted_out_at = now() WHERE user_id = (SELECT user_id FROM public.support_appeals LIMIT 1)`,
    )
    expect((await status(admin)).support_appeal).toEqual({ enabled: true, sent_30d: 2, unsubscribed: 1 })
    expect((await status(admin)).premium_invite).toEqual({ enabled: true, sent_30d: 0, unsubscribed: 0 })
  })

  it('is for admins only', async () => {
    const user = await db.addUser()
    await expect(setSwitch(user, 'support_appeal', false)).rejects.toThrow(/Admins only/)
    await expect(status(user)).rejects.toThrow(/Admins only/)
    await expect(setSwitch(admin, 'newsletter', false)).rejects.toThrow(/Unknown email/)
    await expect(db.asRole('anon', () => db.query(`SELECT public.admin_member_email_status()`))).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      db.asRole('authenticated', () => db.query(`UPDATE public.member_email_settings SET enabled = false`)),
    ).rejects.toThrow(/permission denied/)
    expect(await count('support_appeal_claim')).toBe(0) // nobody qualifies here, and the switch is still on
    expect((await status(admin)).support_appeal.enabled).toBe(true)
  })
})
