// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// net.http_post records each request the database would send to the birthday function.
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dob date,
    is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false);
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text,
    created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.limits (k text, n int);
  CREATE FUNCTION public.consume_rate_limit(_key text, _scope text, _max int, _window_seconds int) RETURNS boolean
  LANGUAGE plpgsql AS $$
  DECLARE v int;
  BEGIN
    UPDATE public.limits SET n = n + 1 WHERE k = _key || _scope RETURNING n INTO v;
    IF v IS NULL THEN INSERT INTO public.limits VALUES (_key || _scope, 1); v := 1; END IF;
    RETURN v <= _max;
  END $$;
  CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
  INSERT INTO vault.decrypted_secrets VALUES ('abia_cron_token', 'CRON');
  CREATE SCHEMA net; CREATE TABLE net.calls (n serial, url text, headers jsonb);
  CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}', params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000)
  RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls (url, headers) VALUES (url, headers) RETURNING n::bigint $$;
`

const TODAY_LAGOS = `(now() AT TIME ZONE 'Africa/Lagos')::date`

describe('greet a member when they save a birthday that is today', () => {
  let db: PGlite
  const calls = async () => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM net.calls`)).rows[0].n
  const member = async () => (await db.query<{ id: string }>(`INSERT INTO profiles DEFAULT VALUES RETURNING id`)).rows[0].id
  const setDob = (id: string, expr: string) => db.query(`UPDATE profiles SET dob = ${expr} WHERE id = $1`, [id])

  beforeEach(async () => {
    db = await PGlite.create()
    await db.exec(PRELUDE)
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261003100000_greet_birthday_when_saved_today.sql'), 'utf8'))
  })

  it('calls the birthday function when the saved birthday is today', async () => {
    const id = await member()
    await setDob(id, `(${TODAY_LAGOS} - interval '30 years')::date`)
    expect(await calls()).toBe(1)
    const h = (await db.query<{ headers: Record<string, string> }>(`SELECT headers FROM net.calls`)).rows[0].headers
    expect(h['x-cron-token']).toBe('CRON')
  })

  it('does nothing for a birthday on another day', async () => {
    const id = await member()
    await setDob(id, `(${TODAY_LAGOS} - interval '30 years' + interval '1 day')::date`)
    expect(await calls()).toBe(0)
  })

  it('does nothing when the member was already greeted today, or is banned', async () => {
    const greeted = await member()
    await db.query(`INSERT INTO notifications (user_id, type) VALUES ($1, 'birthday')`, [greeted])
    await setDob(greeted, `(${TODAY_LAGOS} - interval '25 years')::date`)
    const banned = (await db.query<{ id: string }>(`INSERT INTO profiles (is_banned) VALUES (true) RETURNING id`)).rows[0].id
    await setDob(banned, `(${TODAY_LAGOS} - interval '25 years')::date`)
    expect(await calls()).toBe(0)
  })

  it('ignores saves that do not change the date, and caps repeated changes at 2 a day', async () => {
    const id = await member()
    await setDob(id, `(${TODAY_LAGOS} - interval '20 years')::date`)
    await db.query(`UPDATE profiles SET is_banned = false WHERE id = $1`, [id]) // unrelated update
    await setDob(id, `(${TODAY_LAGOS} - interval '20 years')::date`) // same date
    await setDob(id, `(${TODAY_LAGOS} - interval '21 years')::date`)
    await setDob(id, `(${TODAY_LAGOS} - interval '22 years')::date`)
    expect(await calls()).toBe(2)
  })

  it('also greets a brand-new member whose sign-up birthday is today', async () => {
    await db.query(`INSERT INTO profiles (dob) VALUES ((${TODAY_LAGOS} - interval '18 years')::date)`)
    expect(await calls()).toBe(1)
  })
})
