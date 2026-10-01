// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;
  CREATE TABLE public.threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, content text, is_deleted boolean NOT NULL DEFAULT false);
  CREATE TABLE public.replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, user_id uuid, content text);
  ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Replies viewable by everyone" ON public.replies FOR SELECT TO anon, authenticated USING (true);
  CREATE TABLE public.reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, reply_id uuid, reporter_id uuid, reported_user_id uuid, reason text, status text NOT NULL DEFAULT 'pending');
  CREATE TABLE public.moderation_appeals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, surface text, original_content text, user_note text, status text NOT NULL DEFAULT 'pending');
  CREATE TABLE public.moderation_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, surface text, allowed boolean, created_at timestamptz NOT NULL DEFAULT now());
`

async function makeDb() {
  const db = await PGlite.create()
  await db.exec(PRELUDE)
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261002090000_ugo_moderation_worker.sql'), 'utf8'))
  return db
}

const as = async (db: PGlite, uid: string | null, role: 'anon' | 'authenticated' | null, fn: () => Promise<unknown>) => {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  if (role) await db.query(`SET ROLE ${role}`)
  try {
    return await fn()
  } finally {
    await db.query('RESET ROLE')
  }
}

describe('Ugo background moderation', () => {
  let db: PGlite
  beforeEach(async () => {
    db = await makeDb()
  })

  it('queues every new thread, reply, report and appeal exactly once', async () => {
    const t = (await db.query<{ id: string }>(`INSERT INTO threads (title, content) VALUES ('t', 'c') RETURNING id`)).rows[0].id
    await db.query(`INSERT INTO replies (thread_id, content) VALUES ($1, 'r')`, [t])
    await db.query(`INSERT INTO reports (thread_id, reason) VALUES ($1, 'spam')`, [t])
    await db.query(`INSERT INTO moderation_appeals (surface, original_content, user_note) VALUES ('thread', 'x', 'please')`)
    const kinds = (await db.query<{ kind: string }>(`SELECT kind FROM moderation_queue ORDER BY kind`)).rows.map((r) => r.kind)
    expect(kinds).toEqual(['appeal', 'reply', 'report', 'thread'])
  })

  it('hands each item to only one worker run, and retries stuck items', async () => {
    for (let i = 0; i < 5; i++) await db.query(`INSERT INTO threads (title, content) VALUES ('t', 'c')`)
    const first = (await db.query(`SELECT * FROM claim_moderation_queue(3)`)).rows
    const second = (await db.query(`SELECT * FROM claim_moderation_queue(3)`)).rows
    expect(first).toHaveLength(3)
    expect(second).toHaveLength(2)
    expect((await db.query(`SELECT * FROM claim_moderation_queue(3)`)).rows).toHaveLength(0)
    await db.query(`UPDATE moderation_queue SET claimed_at = now() - interval '11 minutes'`)
    expect((await db.query(`SELECT * FROM claim_moderation_queue(10)`)).rows).toHaveLength(5)
  })

  it('shows hidden replies only to their author and admins', async () => {
    const author = '00000000-0000-0000-0000-00000000000a'
    const other = '00000000-0000-0000-0000-00000000000b'
    const admin = '00000000-0000-0000-0000-00000000000c'
    await db.query(`INSERT INTO admins VALUES ($1)`, [admin])
    await db.query(`INSERT INTO replies (user_id, content, is_hidden) VALUES ($1, 'hidden', true), ($1, 'visible', false)`, [author])
    const seen = async (uid: string | null, role: 'anon' | 'authenticated') =>
      ((await as(db, uid, role, () => db.query<{ content: string }>(`SELECT content FROM replies ORDER BY content`))) as { rows: Array<{ content: string }> }).rows.map(
        (r) => r.content,
      )
    expect(await seen(other, 'authenticated')).toEqual(['visible'])
    expect(await seen(null, 'anon')).toEqual(['visible'])
    expect(await seen(author, 'authenticated')).toEqual(['hidden', 'visible'])
    expect(await seen(admin, 'authenticated')).toEqual(['hidden', 'visible'])
  })

  it('keeps the queue and the claim function away from members', async () => {
    const err = await as(db, null, 'authenticated', () => db.query(`SELECT * FROM moderation_queue`)).catch((e) => (e as Error).message)
    expect(String(err)).toMatch(/permission denied/)
    const err2 = await as(db, null, 'authenticated', () => db.query(`SELECT * FROM claim_moderation_queue(5)`)).catch((e) => (e as Error).message)
    expect(String(err2)).toMatch(/permission denied/)
  })
})
