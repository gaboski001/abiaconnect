// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// Stand-ins for the live objects, including the old "post every thread" trigger.
// net.http_post records every request the database would send to the Facebook function.
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;

  CREATE TABLE public.subgroups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_private boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true);
  CREATE TABLE public.threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, subgroup_id uuid REFERENCES public.subgroups(id),
    is_anonymous boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false, upvotes integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, is_hidden boolean NOT NULL DEFAULT false);
  CREATE TABLE public.reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, status text NOT NULL DEFAULT 'pending');
  CREATE TABLE public.moderation_queue (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, ref_id uuid, status text, outcome text);

  CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
  INSERT INTO vault.decrypted_secrets VALUES ('abia_cron_token', 'CRON-TOKEN');
  CREATE SCHEMA net; CREATE TABLE net.calls (n serial, url text, headers jsonb, body jsonb);
  CREATE FUNCTION net.http_post(url text, headers jsonb, body jsonb) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO net.calls (url, headers, body) VALUES (url, headers, body) RETURNING n::bigint $$;
  CREATE SCHEMA cron; CREATE TABLE cron.job (jobid bigserial, jobname text, schedule text, command text);
  CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO cron.job (jobname, schedule, command) VALUES (n, s, c) RETURNING jobid $$;
  CREATE FUNCTION cron.unschedule(id bigint) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid = id RETURNING true $$;

  -- The old behaviour: every new thread is sent to Facebook.
  CREATE FUNCTION public.notify_facebook_on_new_thread() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN PERFORM net.http_post('old', '{}'::jsonb, jsonb_build_object('thread_id', NEW.id)); RETURN NEW; END $$;
  CREATE TRIGGER trg_notify_facebook_on_new_thread AFTER INSERT ON public.threads FOR EACH ROW EXECUTE FUNCTION public.notify_facebook_on_new_thread();
`

const MEMBER = '11111111-1111-1111-1111-111111111111'
const ADMIN = '33333333-3333-3333-3333-333333333333'

async function makeDb() {
  const db = await PGlite.create()
  await db.exec(PRELUDE)
  await db.query(`INSERT INTO auth.users VALUES ($1), ($2)`, [MEMBER, ADMIN])
  await db.query(`INSERT INTO admins VALUES ($1)`, [ADMIN])
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261002170000_facebook_sharing_approval.sql'), 'utf8'))
  return db
}

const as = async <T,>(db: PGlite, uid: string | null, role: 'anon' | 'authenticated', fn: () => Promise<T>) => {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  await db.query(`SET ROLE ${role}`)
  try {
    return await fn()
  } finally {
    await db.query('RESET ROLE')
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`)
  }
}

describe('Facebook sharing: admin approval + popular threads', () => {
  let db: PGlite
  const thread = async (opts: { upvotes?: number; anonymous?: boolean; group?: string | null; daysOld?: number; ugo?: string | null } = {}) => {
    const id = (await db.query<{ id: string }>(
      `INSERT INTO threads (title, upvotes, is_anonymous, subgroup_id, created_at)
       VALUES ('A good topic', $1, $2, $3, now() - make_interval(days => $4)) RETURNING id`,
      [opts.upvotes ?? 0, opts.anonymous ?? false, opts.group ?? null, opts.daysOld ?? 0],
    )).rows[0].id
    if (opts.ugo !== null) {
      await db.query(`INSERT INTO moderation_queue (kind, ref_id, status, outcome) VALUES ('thread', $1, 'done', $2)`, [id, opts.ugo ?? 'ok'])
    }
    return id
  }
  const calls = async () => (await db.query<{ url: string; headers: Record<string, string>; body: Record<string, string> }>(`SELECT url, headers, body FROM net.calls ORDER BY n`)).rows
  const share = (uid: string | null, role: 'anon' | 'authenticated', id: string) =>
    as(db, uid, role, () => db.query<{ s: string }>(`SELECT public.share_thread_to_facebook($1) AS s`, [id]))

  beforeEach(async () => {
    db = await makeDb()
  })

  it('no longer posts every new thread automatically', async () => {
    await thread()
    expect(await calls()).toEqual([])
  })

  it('lets an admin share a public thread once, signed with the scheduler token', async () => {
    const id = await thread()
    const r = await share(ADMIN, 'authenticated', id)
    expect(r.rows[0].s).toBe('queued')
    const c = await calls()
    expect(c).toHaveLength(1)
    expect(c[0].url).toMatch(/post-thread-to-facebook$/)
    expect(c[0].headers['x-cron-token']).toBe('CRON-TOKEN')
    expect(c[0].body).toEqual({ thread_id: id, action: 'post' })
    // Pressing again does not post twice.
    expect((await share(ADMIN, 'authenticated', id)).rows[0].s).toBe('queued')
    expect(await calls()).toHaveLength(1)
    const row = (await db.query(`SELECT status, source, requested_by FROM facebook_shares`)).rows
    expect(row).toEqual([{ status: 'queued', source: 'admin', requested_by: ADMIN }])
  })

  it('refuses members and anonymous visitors', async () => {
    const id = await thread()
    await expect(share(MEMBER, 'authenticated', id)).rejects.toThrow(/Only admins/)
    await expect(share(null, 'anon', id)).rejects.toThrow(/permission denied/)
    await expect(
      as(db, MEMBER, 'authenticated', () => db.query(`INSERT INTO facebook_shares (thread_id, source) VALUES ($1, 'admin')`, [id])),
    ).rejects.toThrow(/permission denied/)
    await expect(as(db, MEMBER, 'authenticated', () => db.query(`SELECT public.queue_popular_threads_for_facebook()`))).rejects.toThrow(/permission denied/)
    await expect(as(db, MEMBER, 'authenticated', () => db.query(`SELECT public.dispatch_facebook_share($1)`, [id]))).rejects.toThrow(/permission denied/)
    expect(await calls()).toEqual([])
  })

  it('never shares anonymous, private-group or removed threads, even for an admin', async () => {
    const priv = (await db.query<{ id: string }>(`INSERT INTO subgroups (is_private) VALUES (true) RETURNING id`)).rows[0].id
    const anon = await thread({ anonymous: true })
    const inPrivate = await thread({ group: priv })
    const removed = await thread()
    await db.query(`UPDATE threads SET is_deleted = true WHERE id = $1`, [removed])
    await expect(share(ADMIN, 'authenticated', anon)).rejects.toThrow(/anonymous threads are never shared/)
    await expect(share(ADMIN, 'authenticated', inPrivate)).rejects.toThrow(/private groups are never shared/)
    await expect(share(ADMIN, 'authenticated', removed)).rejects.toThrow(/removed/)
    expect(await calls()).toEqual([])
  })

  it('lets admins see share status, but not members', async () => {
    const id = await thread()
    await share(ADMIN, 'authenticated', id)
    expect((await as(db, ADMIN, 'authenticated', () => db.query(`SELECT status FROM facebook_shares`))).rows).toHaveLength(1)
    expect((await as(db, MEMBER, 'authenticated', () => db.query(`SELECT status FROM facebook_shares`))).rows).toHaveLength(0)
  })

  it('auto-shares popular threads only when Ugo cleared them, unreported, public and recent', async () => {
    const priv = (await db.query<{ id: string }>(`INSERT INTO subgroups (is_private) VALUES (true) RETURNING id`)).rows[0].id
    const good = await thread({ upvotes: 12 })
    const byReplies = await thread({ upvotes: 0 })
    for (let i = 0; i < 10; i++) await db.query(`INSERT INTO replies (thread_id) VALUES ($1)`, [byReplies])
    const hiddenReplies = await thread({ upvotes: 0 })
    for (let i = 0; i < 10; i++) await db.query(`INSERT INTO replies (thread_id, is_hidden) VALUES ($1, true)`, [hiddenReplies])
    const notPopular = await thread({ upvotes: 3 })
    const notReviewed = await thread({ upvotes: 50, ugo: null })
    const flagged = await thread({ upvotes: 50, ugo: 'flagged' })
    const reported = await thread({ upvotes: 50 })
    await db.query(`INSERT INTO reports (thread_id) VALUES ($1)`, [reported])
    const privateGroup = await thread({ upvotes: 50, group: priv })
    const old = await thread({ upvotes: 50, daysOld: 8 })

    const n = (await db.query<{ n: number }>(`SELECT public.queue_popular_threads_for_facebook() AS n`)).rows[0].n
    expect(n).toBe(2)
    const shared = (await db.query<{ thread_id: string; source: string }>(`SELECT thread_id, source FROM facebook_shares ORDER BY thread_id`)).rows
    expect(shared.map((r) => r.thread_id).sort()).toEqual([good, byReplies].sort())
    expect(shared.every((r) => r.source === 'popular')).toBe(true)
    for (const id of [hiddenReplies, notPopular, notReviewed, flagged, reported, privateGroup, old]) {
      expect(shared.some((r) => r.thread_id === id)).toBe(false)
    }
    // Running again does not share them twice.
    expect((await db.query<{ n: number }>(`SELECT public.queue_popular_threads_for_facebook() AS n`)).rows[0].n).toBe(0)
  })

  it('shares at most 3 popular threads per 24 hours', async () => {
    for (let i = 0; i < 5; i++) await thread({ upvotes: 20 + i })
    expect((await db.query<{ n: number }>(`SELECT public.queue_popular_threads_for_facebook() AS n`)).rows[0].n).toBe(3)
    expect((await db.query<{ n: number }>(`SELECT public.queue_popular_threads_for_facebook() AS n`)).rows[0].n).toBe(0)
  })

  it('takes the Facebook post down when a shared thread is removed, moved to a private group, or deleted', async () => {
    const priv = (await db.query<{ id: string }>(`INSERT INTO subgroups (is_private) VALUES (true) RETURNING id`)).rows[0].id
    const [a, b, c] = [await thread(), await thread(), await thread()]
    for (const [id, post] of [[a, '111_1'], [b, '111_2'], [c, '111_3']]) {
      await db.query(`INSERT INTO facebook_shares (thread_id, status, source, fb_post_id) VALUES ($1, 'posted', 'admin', $2)`, [id, post])
    }
    await db.query(`UPDATE threads SET is_deleted = true WHERE id = $1`, [a])
    await db.query(`UPDATE threads SET subgroup_id = $2 WHERE id = $1`, [b, priv])
    await db.query(`DELETE FROM threads WHERE id = $1`, [c])
    const bodies = (await calls()).map((x) => x.body)
    expect(bodies).toEqual([
      { thread_id: a, action: 'remove' },
      { thread_id: b, action: 'remove' },
      { thread_id: c, action: 'remove', fb_post_id: '111_3' },
    ])
    const statuses = (await db.query<{ status: string }>(`SELECT status FROM facebook_shares ORDER BY fb_post_id`)).rows.map((r) => r.status)
    expect(statuses).toEqual(['removing', 'removing'])
  })

  it('schedules the popular-thread check every 30 minutes', async () => {
    const jobs = (await db.query(`SELECT jobname, schedule, command FROM cron.job`)).rows
    expect(jobs).toEqual([{ jobname: 'facebook-popular-threads', schedule: '*/30 * * * *', command: 'SELECT public.queue_popular_threads_for_facebook()' }])
  })
})
