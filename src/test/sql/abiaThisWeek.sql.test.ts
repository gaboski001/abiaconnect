// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// The weekly email's rules on the real migrations. The harness has no forum, so
// add minimal copies of what the email reads.
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
]

let db: Db
let admin: string

const claim = async () =>
  (await db.query<{ user_id: string; token: string }>(`SELECT * FROM public.abia_this_week_claim()`)).rows
const posts = async () => (await db.query<{ title: string }>(`SELECT * FROM public.abia_this_week_posts()`)).rows.map((r) => r.title)
const thread = (title: string, extra = 'false, false, null::uuid, now()') =>
  db.exec(`INSERT INTO public.threads (title, is_deleted, is_anonymous, subgroup_id, created_at) SELECT '${title}', ${extra}`)
const switchOn = (on: boolean) => db.query(`UPDATE public.member_email_settings SET enabled = $1 WHERE key = 'abia_this_week'`, [on])

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
  admin = await db.addUser({ admin: true })
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.abia_this_week_emails;
    DELETE FROM public.threads;
    UPDATE auth.users SET last_sign_in_at = NULL;
  `)
  await switchOn(false)
})

const threeThreads = async () => {
  await thread('One')
  await thread('Two')
  await thread('Three')
}

describe('Abia this week email', () => {
  it('starts switched off and emails nobody', async () => {
    await member()
    await threeThreads()
    expect(await claim()).toHaveLength(0)
    const { rows } = await db.query<{ enabled: boolean }>(`SELECT enabled FROM public.member_email_settings WHERE key = 'abia_this_week'`)
    expect(rows[0].enabled).toBe(false)
  })

  it('emails an active member once when switched on', async () => {
    const id = await member()
    await threeThreads()
    await switchOn(true)
    expect((await claim()).map((r) => r.user_id)).toEqual([id])
    expect(await claim()).toHaveLength(0)
  })

  it('sends nothing in a quiet week', async () => {
    await member()
    await thread('One')
    await thread('Two')
    await switchOn(true)
    expect(await claim()).toHaveLength(0)
  })

  it('leaves out members who have not signed in lately', async () => {
    await db.addUser()
    await threeThreads()
    await switchOn(true)
    expect(await claim()).toHaveLength(0)
  })

  it('never emails a member again after they unsubscribe', async () => {
    await member()
    await threeThreads()
    await switchOn(true)
    const [row] = await claim()
    await db.asRole('anon', () => db.query(`SELECT public.abia_this_week_opt_out($1)`, [row.token]))
    await db.query(`UPDATE public.abia_this_week_emails SET last_sent_at = now() - interval '30 days'`)
    expect(await claim()).toHaveLength(0)
  })

  it('never shows anonymous, deleted, private group or old posts', async () => {
    await thread('Public')
    await thread('Anonymous', 'false, true, null::uuid, now()')
    await thread('Deleted', 'true, false, null::uuid, now()')
    await thread('Private', 'false, false, gen_random_uuid(), now()')
    await thread('Old', `false, false, null::uuid, now() - interval '8 days'`)
    expect(await posts()).toEqual(['Public'])
  })

  it('cannot be read or triggered by ordinary members', async () => {
    await db.as(await member())
    await expect(db.asRole('authenticated', () => db.query(`SELECT * FROM public.abia_this_week_claim()`))).rejects.toThrow()
    await expect(db.asRole('authenticated', () => db.query(`SELECT * FROM public.abia_this_week_posts()`))).rejects.toThrow()
    await db.as(null)
  })

  it('shows on the admin switches screen', async () => {
    await db.as(admin)
    const row = await db.asRole('authenticated', () => db.one<{ s: Record<string, { enabled: boolean }> }>(`SELECT public.admin_member_email_status() AS s`))
    expect(row.s.abia_this_week.enabled).toBe(false)
    expect(row.s.support_appeal).toBeDefined()
    await db.as(null)
  })
})
