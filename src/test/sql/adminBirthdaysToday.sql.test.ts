// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;
  GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, username text,
    avatar_url text, email text, dob date, is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false);
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text,
    created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.email_send_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_name text,
    recipient_email text, status text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE FUNCTION public.consume_rate_limit(_key text, _scope text, _max int, _window_seconds int) RETURNS boolean
    LANGUAGE sql AS $$ SELECT true $$;
  CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
  INSERT INTO vault.decrypted_secrets VALUES ('abia_cron_token', 'CRON');
  CREATE SCHEMA net; CREATE TABLE net.calls (n serial, url text);
  CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}', params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000)
  RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls (url) VALUES (url) RETURNING n::bigint $$;
`

const ADMIN = '33333333-3333-3333-3333-333333333333'
const MEMBER = '11111111-1111-1111-1111-111111111111'
const TODAY = `(now() AT TIME ZONE 'Africa/Lagos')::date`

describe('Admin -> Birthdays today', () => {
  let db: PGlite
  const as = async <T,>(uid: string | null, role: 'anon' | 'authenticated', fn: () => Promise<T>) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
    await db.query(`SET ROLE ${role}`)
    try {
      return await fn()
    } finally {
      await db.query('RESET ROLE')
    }
  }

  beforeEach(async () => {
    db = await PGlite.create()
    await db.exec(PRELUDE)
    await db.query(`INSERT INTO admins VALUES ($1)`, [ADMIN])
    await db.query(`INSERT INTO profiles (id, display_name) VALUES ($1, 'Admin'), ($2, 'Member')`, [ADMIN, MEMBER])
    for (const f of ['20261003100000_greet_birthday_when_saved_today.sql', '20261003110000_admin_birthdays_today.sql']) {
      await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8'))
    }
  })

  it('lists today’s birthdays with greeted and emailed status, for admins', async () => {
    const [a, b, c] = (await db.query<{ id: string }>(
      `INSERT INTO profiles (display_name, email, dob) VALUES
        ('Ada', 'ada@x.test', (${TODAY} - interval '30 years')::date),
        ('Bayo', 'bayo@x.test', (${TODAY} - interval '25 years')::date),
        ('Chi', NULL, (${TODAY} - interval '40 years' + interval '1 day')::date)
       RETURNING id`,
    )).rows.map((r) => r.id)
    void c
    await db.query(`INSERT INTO notifications (user_id, type) VALUES ($1, 'birthday')`, [a])
    await db.query(`INSERT INTO email_send_log (template_name, recipient_email, status) VALUES ('birthday-greeting', 'ada@x.test', 'sent')`)
    const rows = (await as(ADMIN, 'authenticated', () =>
      db.query<{ display_name: string; turning: number; greeted: boolean; emailed: boolean; has_email: boolean }>(
        `SELECT display_name, turning, greeted, emailed, has_email FROM public.admin_birthdays_today()`,
      ),
    )).rows
    expect(rows).toEqual([
      { display_name: 'Ada', turning: 30, greeted: true, emailed: true, has_email: true },
      { display_name: 'Bayo', turning: 25, greeted: false, emailed: false, has_email: true },
    ])
    void b
    const cov = (await as(ADMIN, 'authenticated', () => db.query<{ c: { members: number; with_birthday: number } }>(`SELECT public.admin_birthday_coverage() AS c`))).rows[0].c
    expect(cov).toEqual({ members: 5, with_birthday: 3 })
  })

  it('refuses members and anonymous visitors', async () => {
    for (const q of [
      `SELECT * FROM public.admin_birthdays_today()`,
      `SELECT public.admin_birthday_coverage()`,
      `SELECT * FROM public.admin_find_members('Ad')`,
      `SELECT public.admin_set_member_dob('${MEMBER}', '1990-01-01')`,
    ]) {
      await expect(as(MEMBER, 'authenticated', () => db.query(q)), q).rejects.toThrow(/Admins only/)
      await expect(as(null, 'anon', () => db.query(q)), q).rejects.toThrow(/permission denied/)
    }
  })

  it('finds members and saves a birthday; today’s birthday greets them straight away', async () => {
    const found = (await as(ADMIN, 'authenticated', () => db.query<{ display_name: string }>(`SELECT display_name FROM public.admin_find_members('mem')`))).rows
    expect(found).toEqual([{ display_name: 'Member' }])
    await as(ADMIN, 'authenticated', () => db.query(`SELECT public.admin_set_member_dob($1, (${TODAY} - interval '28 years')::date)`, [MEMBER]))
    expect((await db.query(`SELECT 1 FROM net.calls`)).rows).toHaveLength(1)
    const listed = (await as(ADMIN, 'authenticated', () => db.query<{ display_name: string }>(`SELECT display_name FROM public.admin_birthdays_today()`))).rows
    expect(listed).toEqual([{ display_name: 'Member' }])
  })

  it('rejects impossible birthdays', async () => {
    await expect(as(ADMIN, 'authenticated', () => db.query(`SELECT public.admin_set_member_dob($1, ${TODAY} + 1)`, [MEMBER]))).rejects.toThrow(/real date/)
    await expect(as(ADMIN, 'authenticated', () => db.query(`SELECT public.admin_set_member_dob($1, (${TODAY} - interval '5 years')::date)`, [MEMBER]))).rejects.toThrow(/between 13 and 120/)
  })
})
