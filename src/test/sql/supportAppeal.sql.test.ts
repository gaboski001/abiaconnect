// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Runs the real migration on an in-process Postgres (PGlite). The harness has
// no sign-in dates, donations or donation accounts, so add minimal copies.
const EXTRAS = `
  ALTER TABLE auth.users ADD COLUMN last_sign_in_at timestamptz, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  CREATE TABLE public.donations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_email text, created_by uuid,
    status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.donation_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_active boolean NOT NULL DEFAULT true);
`

let db: Db

type Claim = { user_id: string; email: string; name: string; token: string }
const claim = async (limit = 150) =>
  (await db.query<Claim>(`SELECT * FROM public.support_appeal_claim($1)`, [limit])).rows

/** A member with an email who joined `joinedDays` ago and last signed in `seenDays` ago. */
async function member(seenDays = 3, joinedDays = 60) {
  const id = await db.addUser()
  await db.query(`UPDATE public.profiles SET email = $1 WHERE id = $2`, [`${id}@example.com`, id])
  await db.query(
    `UPDATE auth.users SET last_sign_in_at = now() - make_interval(days => $1), created_at = now() - make_interval(days => $2) WHERE id = $3`,
    [seenDays, joinedDays, id],
  )
  return id
}

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(EXTRAS)
  await db.exec(
    readFileSync(resolve(__dirname, '../../../supabase/migrations/20261012120000_support_appeal_email.sql'), 'utf8'),
  )
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.support_appeals;
    DELETE FROM public.donations;
    DELETE FROM public.donation_accounts;
    UPDATE auth.users SET last_sign_in_at = NULL;
    UPDATE public.payment_providers SET is_enabled = (provider = 'paystack');
  `)
})

describe('support appeal email', () => {
  it('picks an active member once every 90 days, with the same unsubscribe link', async () => {
    const id = await member()
    const [first, ...rest] = await claim()
    expect(rest).toHaveLength(0)
    expect(first).toMatchObject({ user_id: id, email: `${id}@example.com`, name: 'User' })
    expect(await claim()).toHaveLength(0)
    await db.query(`UPDATE public.support_appeals SET last_sent_at = now() - interval '60 days'`)
    expect(await claim()).toHaveLength(0)
    await db.query(`UPDATE public.support_appeals SET last_sent_at = now() - interval '91 days'`)
    const [again] = await claim()
    expect(again.token).toBe(first.token)
  })

  it('leaves out inactive, brand-new, banned and email-less members', async () => {
    await member(120)
    await member(1, 5)
    const banned = await member()
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [banned])
    const noEmail = await member()
    await db.query(`UPDATE public.profiles SET email = NULL WHERE id = $1`, [noEmail])
    expect(await claim()).toHaveLength(0)
  })

  it('leaves out members who gave recently, by account or by email', async () => {
    const byAccount = await member()
    await db.query(`INSERT INTO public.donations (created_by, status) VALUES ($1, 'confirmed')`, [byAccount])
    const byEmail = await member()
    await db.query(`INSERT INTO public.donations (donor_email, status) VALUES ($1, 'confirmed')`, [
      `${byEmail}@EXAMPLE.com`,
    ])
    const unpaid = await member()
    await db.query(`INSERT INTO public.donations (created_by, status) VALUES ($1, 'pending')`, [unpaid])
    const longAgo = await member()
    await db.query(
      `INSERT INTO public.donations (created_by, status, created_at) VALUES ($1, 'confirmed', now() - interval '100 days')`,
      [longAgo],
    )
    expect((await claim()).map((r) => r.user_id).sort()).toEqual([unpaid, longAgo].sort())
  })

  it('sends in batches until everyone has had one', async () => {
    await member()
    await member()
    await member()
    expect(await claim(2)).toHaveLength(2)
    expect(await claim(2)).toHaveLength(1)
    expect(await claim(2)).toHaveLength(0)
  })

  it('sends nothing while there is no way to give', async () => {
    await member()
    await db.query(`UPDATE public.payment_providers SET is_enabled = false`)
    expect(await claim()).toHaveLength(0)
    await db.query(`INSERT INTO public.donation_accounts DEFAULT VALUES`)
    expect(await claim()).toHaveLength(1)
  })

  it('stops for good when the member uses the unsubscribe link', async () => {
    await member()
    const [{ token }] = await claim()
    const ok = await db.asRole('anon', () =>
      db.one<{ ok: boolean }>(`SELECT public.support_appeal_opt_out($1) AS ok`, [token]),
    )
    expect(ok.ok).toBe(true)
    await db.query(`UPDATE public.support_appeals SET last_sent_at = now() - interval '200 days'`)
    expect(await claim()).toHaveLength(0)
    const wrong = await db.one<{ ok: boolean }>(`SELECT public.support_appeal_opt_out(gen_random_uuid()) AS ok`)
    expect(wrong.ok).toBe(false)
  })

  it('cannot be run or read by visitors and members', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(db.asRole(role, () => db.query(`SELECT * FROM public.support_appeal_claim()`))).rejects.toThrow(
        /permission denied/,
      )
      await expect(db.asRole(role, () => db.query(`SELECT * FROM public.support_appeals`))).rejects.toThrow(
        /permission denied/,
      )
    }
  })
})
