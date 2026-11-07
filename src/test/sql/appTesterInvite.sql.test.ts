// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// The tester invitation's rules on the real migrations. The harness has no forum,
// so add minimal copies of what the older email migrations read.
const EXTRAS = `
  ALTER TABLE auth.users ADD COLUMN last_sign_in_at timestamptz, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  CREATE TABLE public.donations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_email text, created_by uuid,
    status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.donation_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_active boolean NOT NULL DEFAULT true);
  CREATE TABLE public.threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, subgroup_id uuid,
    is_deleted boolean NOT NULL DEFAULT false, is_anonymous boolean NOT NULL DEFAULT false, upvotes int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, is_hidden boolean NOT NULL DEFAULT false);
  CREATE FUNCTION public.is_public_subgroup(_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
  CREATE FUNCTION public.lga_of_the_month() RETURNS TABLE (lga text, score bigint) LANGUAGE sql STABLE AS $$ SELECT 'x'::text, 0::bigint $$;
`
const MIGRATIONS = [
  '20261012090000_premium_invite_email.sql',
  '20261012120000_support_appeal_email.sql',
  '20261013120000_member_email_switches.sql',
  '20261107150000_abia_this_week_email.sql',
  '20261107170000_app_tester_invite.sql',
]

let db: Db

const claim = async () =>
  (await db.query<{ user_id: string; token: string }>(`SELECT * FROM public.app_tester_invite_claim()`)).rows
const switchOn = (on: boolean) =>
  db.query(`UPDATE public.member_email_settings SET enabled = $1 WHERE key = 'app_tester_invite'`, [on])

async function member() {
  const id = await db.addUser()
  await db.query(`UPDATE public.profiles SET email = $1 WHERE id = $2`, [`${id}@example.com`, id])
  await db.query(`UPDATE auth.users SET last_sign_in_at = now() - interval '2 days' WHERE id = $1`, [id])
  return id
}

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(EXTRAS)
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations', file), 'utf8'))
  }
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.app_tester_invites;
    DELETE FROM public.abia_this_week_emails;
    UPDATE auth.users SET last_sign_in_at = NULL;
  `)
  await switchOn(false)
})

describe('App tester invitation', () => {
  it('starts off and emails nobody until it is switched on', async () => {
    await member()
    expect(await claim()).toEqual([])
    await switchOn(true)
    expect(await claim()).toHaveLength(1)
  })

  it('emails each member once', async () => {
    await member()
    await switchOn(true)
    expect(await claim()).toHaveLength(1)
    expect(await claim()).toEqual([])
  })

  it('leaves out members who have not signed in for 90 days', async () => {
    const id = await member()
    await db.query(`UPDATE auth.users SET last_sign_in_at = now() - interval '91 days' WHERE id = $1`, [id])
    await switchOn(true)
    expect(await claim()).toEqual([])
  })

  it('leaves out members who unsubscribed from another email', async () => {
    const id = await member()
    await db.query(`INSERT INTO public.abia_this_week_emails (user_id, opted_out_at) VALUES ($1, now())`, [id])
    await switchOn(true)
    expect(await claim()).toEqual([])
  })

  it('tries a failed send again, three times at most', async () => {
    const id = await member()
    await switchOn(true)
    for (let i = 0; i < 3; i++) {
      expect(await claim()).toHaveLength(1)
      await db.query(`SELECT public.app_tester_invite_retry($1)`, [id])
    }
    expect(await claim()).toEqual([])
  })

  it('stops for good after the unsubscribe link, which works without signing in', async () => {
    const id = await member()
    await switchOn(true)
    const [row] = await claim()
    await db.query(`SELECT public.app_tester_invite_retry($1)`, [id])
    await db.asRole('anon', () => db.query(`SELECT public.app_tester_invite_opt_out($1)`, [row.token]))
    expect(await claim()).toEqual([])
  })

  it('keeps the list and the sending functions away from members', async () => {
    await expect(db.asRole('authenticated', () => db.query(`SELECT * FROM public.app_tester_invites`))).rejects.toThrow()
    await expect(db.asRole('authenticated', () => db.query(`SELECT * FROM public.app_tester_invite_claim()`))).rejects.toThrow()
    await expect(db.asRole('anon', () => db.query(`SELECT public.app_tester_invite_retry(gen_random_uuid())`))).rejects.toThrow()
  })
})
