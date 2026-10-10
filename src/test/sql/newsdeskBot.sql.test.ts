// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const AUTHOR = '2db15d64-4eb1-4bec-89f3-18f08d26c501'
const ADMIN = '33333333-3333-3333-3333-333333333333'
const ADMIN2 = '44444444-4444-4444-4444-444444444444'
const MEMBER = '11111111-1111-1111-1111-111111111111'

// Stand-ins for the live objects the migration builds on.
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;
  GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated, service_role;

  CREATE TABLE public.profiles (id uuid PRIMARY KEY, display_name text);
  CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text UNIQUE,
    description text, icon text, color text, display_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true);
  CREATE TABLE public.threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false);
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
    type text NOT NULL, message text, link text, created_at timestamptz NOT NULL DEFAULT now());

  CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
  CREATE SCHEMA net;
  CREATE SCHEMA cron; CREATE TABLE cron.job (jobid bigserial, jobname text, schedule text, command text);
  CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO cron.job (jobname, schedule, command) VALUES (n, s, c) RETURNING jobid $$;
  CREATE FUNCTION cron.unschedule(id bigint) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobid = id RETURNING true $$;
`

const MIGRATION = ['20261010090000_newsdesk_bot.sql', '20261010120000_newsdesk_banners.sql', '20261010140000_newsdesk_share_feed.sql', '20261010160000_newsdesk_more_posts_and_gossip.sql']
  .map((f) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8'))
  .join('\n')

describe('Newsdesk bot database', () => {
  let db: PGlite
  let forum: string

  const as = async <T,>(uid: string | null, role: 'anon' | 'authenticated' | 'service_role', fn: () => Promise<T>) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
    await db.query(`SET ROLE ${role}`)
    try {
      return await fn()
    } finally {
      await db.query('RESET ROLE')
      await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`)
    }
  }

  const post = (fields: Record<string, unknown> = {}) => {
    const row = { run_date: '2026-10-10', category_id: forum, category_slug: 'business-commerce', scope: 'abia', title: 'T', content: '<p>c</p>', ...fields }
    const keys = Object.keys(row)
    return db.query<{ id: string }>(
      `INSERT INTO public.newsdesk_posts (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      Object.values(row),
    )
  }

  beforeEach(async () => {
    db = await PGlite.create()
    await db.exec(PRELUDE)
    await db.query(`INSERT INTO auth.users VALUES ($1), ($2), ($3), ($4)`, [AUTHOR, ADMIN, ADMIN2, MEMBER])
    await db.query(`INSERT INTO profiles VALUES ($1, 'Newsdesk'), ($2, 'Admin'), ($3, 'Admin Two'), ($4, 'Member')`, [AUTHOR, ADMIN, ADMIN2, MEMBER])
    await db.query(`INSERT INTO admins VALUES ($1), ($2)`, [ADMIN, ADMIN2])
    forum = (await db.query<{ id: string }>(`INSERT INTO categories (name, slug, display_order) VALUES ('Business & Commerce', 'business-commerce', 3) RETURNING id`)).rows[0].id
    await db.exec(MIGRATION)
  })

  it('starts switched off, posting as the Newsdesk account, with the sensitive forums and Gossip held', async () => {
    const s = (await db.query(`SELECT enabled, author_id, max_posts_per_day, review_slugs FROM newsdesk_settings`)).rows
    expect(s).toEqual([
      {
        enabled: false,
        author_id: AUTHOR,
        max_posts_per_day: 8,
        review_slugs: ['politics-governance', 'security-safety', 'health-wellness', 'faith-spirituality', 'gossip'],
      },
    ])
  })

  it('can be applied again without losing the admin’s settings', async () => {
    await db.query(`UPDATE newsdesk_settings SET enabled = true, max_posts_per_day = 5`)
    await db.exec(MIGRATION)
    expect((await db.query(`SELECT enabled, max_posts_per_day FROM newsdesk_settings`)).rows).toEqual([{ enabled: true, max_posts_per_day: 5 }])
    expect((await db.query(`SELECT jobname, schedule FROM cron.job`)).rows).toEqual([{ jobname: 'daily-newsdesk', schedule: '30 6,11,16 * * *' }])
  })

  it('leaves the posting account empty when the Newsdesk account does not exist', async () => {
    const fresh = await PGlite.create()
    await fresh.exec(PRELUDE)
    await fresh.exec(MIGRATION)
    expect((await fresh.query(`SELECT author_id FROM newsdesk_settings`)).rows).toEqual([{ author_id: null }])
  })

  it('lets admins switch the bot on and change its settings; nobody else', async () => {
    await as(ADMIN, 'authenticated', () => db.query(`UPDATE newsdesk_settings SET enabled = true, max_posts_per_day = 5`))
    expect((await db.query(`SELECT enabled, max_posts_per_day FROM newsdesk_settings`)).rows).toEqual([{ enabled: true, max_posts_per_day: 5 }])

    // A member's update matches no row (row-level security), so nothing changes.
    await as(MEMBER, 'authenticated', () => db.query(`UPDATE newsdesk_settings SET enabled = false`))
    expect((await db.query(`SELECT enabled FROM newsdesk_settings`)).rows).toEqual([{ enabled: true }])
    expect((await as(MEMBER, 'authenticated', () => db.query(`SELECT * FROM newsdesk_settings`))).rows).toEqual([])
    await expect(as(null, 'anon', () => db.query(`SELECT * FROM newsdesk_settings`))).rejects.toThrow(/permission denied/)

    await expect(as(ADMIN, 'authenticated', () => db.query(`UPDATE newsdesk_settings SET max_posts_per_day = 50`))).rejects.toThrow(/check/)
    await expect(as(ADMIN, 'authenticated', () => db.query(`INSERT INTO newsdesk_settings (id) VALUES (false)`))).rejects.toThrow(/permission denied/)
  })

  it('shows the bot’s posts and runs to admins only, and only the server can write them', async () => {
    await post()
    await db.query(`INSERT INTO newsdesk_runs (trigger, note) VALUES ('schedule', 'ok')`)
    for (const table of ['newsdesk_posts', 'newsdesk_runs']) {
      expect((await as(ADMIN, 'authenticated', () => db.query(`SELECT 1 FROM ${table}`))).rows, table).toHaveLength(1)
      expect((await as(MEMBER, 'authenticated', () => db.query(`SELECT 1 FROM ${table}`))).rows, table).toHaveLength(0)
      await expect(as(null, 'anon', () => db.query(`SELECT 1 FROM ${table}`)), table).rejects.toThrow(/permission denied/)
      await expect(as(ADMIN, 'authenticated', () => db.query(`DELETE FROM ${table}`)), table).rejects.toThrow(/permission denied/)
    }
    await expect(as(ADMIN, 'authenticated', () => db.query(`UPDATE newsdesk_posts SET status = 'published'`))).rejects.toThrow(/permission denied/)
    await as(null, 'service_role', () => db.query(`UPDATE newsdesk_posts SET status = 'rejected'`))
    expect((await db.query(`SELECT status FROM newsdesk_posts`)).rows).toEqual([{ status: 'rejected' }])
  })

  it('allows several posts in a forum on the same day', async () => {
    await post()
    await post({ title: 'Second story' })
    await post({ title: 'Third story' })
    expect((await db.query(`SELECT 1 FROM newsdesk_posts WHERE run_date = '2026-10-10'`)).rows).toHaveLength(3)
    await expect(post({ status: 'draft' })).rejects.toThrow(/check/)
  })

  it('gives each forum its own number of posts a day, more for the busy forums', async () => {
    const s = (await db.query<{ default_forum_limit: number; forum_limits: Record<string, number> }>(
      `SELECT default_forum_limit, forum_limits FROM newsdesk_settings`,
    )).rows[0]
    expect(s).toEqual({
      default_forum_limit: 2,
      forum_limits: { 'general-discussion': 3, 'politics-governance': 3, 'culture-heritage': 3, gossip: 3 },
    })
    await as(ADMIN, 'authenticated', () => db.query(`UPDATE newsdesk_settings SET forum_limits = '{"gossip": 5, "relationship": 0}'`))
    expect((await db.query(`SELECT forum_limits FROM newsdesk_settings`)).rows[0]).toEqual({ forum_limits: { gossip: 5, relationship: 0 } })
    await expect(as(ADMIN, 'authenticated', () => db.query(`UPDATE newsdesk_settings SET default_forum_limit = 50`))).rejects.toThrow(/check/)
  })

  it('creates the Gossip forum once, last in the list, held for approval', async () => {
    const rows = (await db.query(`SELECT name, slug, icon, display_order, is_active FROM categories WHERE slug = 'gossip'`)).rows
    expect(rows).toEqual([{ name: 'Gossip', slug: 'gossip', icon: '🎤', display_order: 4, is_active: true }])
    await db.query(`UPDATE categories SET name = 'Gist & Gossip' WHERE slug = 'gossip'`)
    await db.exec(MIGRATION)
    expect((await db.query(`SELECT name FROM categories WHERE slug = 'gossip'`)).rows).toEqual([{ name: 'Gist & Gossip' }])
    expect((await db.query<{ review_slugs: string[] }>(`SELECT review_slugs FROM newsdesk_settings`)).rows[0].review_slugs.filter((x) => x === 'gossip')).toHaveLength(1)
  })
  it('gives a published bot thread its forum share page, to anyone', async () => {
    const thread = (await db.query<{ id: string }>(`INSERT INTO threads (title) VALUES ('Bot thread') RETURNING id`)).rows[0].id
    const other = (await db.query<{ id: string }>(`INSERT INTO threads (title) VALUES ('Member thread') RETURNING id`)).rows[0].id
    const path = `/share/forum-business-commerce.html?t=${thread}`
    const id = (await post({ thread_id: thread, share_path: path })).rows[0].id
    const lookup = (t: string, role: 'anon' | 'authenticated' = 'anon') =>
      as(null, role, async () => (await db.query<{ p: string | null }>(`SELECT public.thread_share_path($1) AS p`, [t])).rows[0].p)

    expect(await lookup(thread)).toBeNull() // still waiting for approval
    await db.query(`UPDATE newsdesk_posts SET status = 'published' WHERE id = $1`, [id])
    expect(await lookup(thread)).toBe(path)
    expect(await lookup(thread, 'authenticated')).toBe(path)
    expect(await lookup(other)).toBeNull()

    await db.query(`UPDATE newsdesk_posts SET share_path = 'https://evil.example/x' WHERE id = $1`, [id])
    expect(await lookup(thread)).toBeNull() // anything that is not a forum share page is ignored
    await db.query(`UPDATE newsdesk_posts SET share_path = $2 WHERE id = $1`, [id, path])
    await db.query(`UPDATE threads SET is_deleted = true WHERE id = $1`, [thread])
    expect(await lookup(thread)).toBeNull() // removed thread
  })

  it('keeps each post’s banner headline and picture address', async () => {
    const id = (await post({ banner_title: 'Short headline', banner_url: 'https://x/storage/v1/object/public/newsdesk/banners/a.jpg' })).rows[0].id
    const row = (await as(ADMIN, 'authenticated', () => db.query(`SELECT banner_title, banner_url FROM newsdesk_posts WHERE id = $1`, [id]))).rows[0]
    expect(row).toEqual({ banner_title: 'Short headline', banner_url: 'https://x/storage/v1/object/public/newsdesk/banners/a.jpg' })
    await post({ run_date: '2026-10-12' }) // a post without a banner is fine
  })

  it('lists published bot posts that have a banner, for the share-page job', async () => {
    const thread = async (title: string) => (await db.query<{ id: string }>(`INSERT INTO threads (title) VALUES ($1) RETURNING id`, [title])).rows[0].id
    const live = await thread('Live')
    const noBanner = await thread('No banner')
    const waiting = await thread('Waiting')
    const removed = await thread('Removed')
    await post({ run_date: '2026-10-01', thread_id: live, status: 'published', banner_url: 'https://x/a.jpg', banner_title: 'Short', title: 'Draft title' })
    await post({ run_date: '2026-10-02', thread_id: noBanner, status: 'published' })
    await post({ run_date: '2026-10-03', thread_id: waiting, banner_url: 'https://x/b.jpg' })
    await post({ run_date: '2026-10-04', thread_id: removed, status: 'published', banner_url: 'https://x/c.jpg' })
    await db.query(`UPDATE threads SET is_deleted = true WHERE id = $1`, [removed])

    const feed = (await as(null, 'anon', () => db.query(`SELECT * FROM public.newsdesk_share_feed()`))).rows
    // The thread's own title is used (an admin may have edited it since).
    expect(feed).toEqual([{ thread_id: live, title: 'Live', banner_title: 'Short', banner_url: 'https://x/a.jpg', content: '<p>c</p>' }])

    await db.query(`UPDATE newsdesk_posts SET created_at = now() - interval '60 days'`)
    expect((await as(null, 'anon', () => db.query(`SELECT * FROM public.newsdesk_share_feed()`))).rows).toEqual([])
  })

  it('keeps the record but forgets the thread when the thread is deleted', async () => {
    const thread = (await db.query<{ id: string }>(`INSERT INTO threads (title) VALUES ('Bot thread') RETURNING id`)).rows[0].id
    await post({ thread_id: thread, status: 'published' })
    await db.query(`DELETE FROM threads WHERE id = $1`, [thread])
    expect((await db.query(`SELECT status, thread_id FROM newsdesk_posts`)).rows).toEqual([{ status: 'published', thread_id: null }])
  })

  it('tells every admin once a day that posts are waiting', async () => {
    const notify = (n: number) => as(null, 'service_role', async () => (await db.query<{ n: number }>(`SELECT public.newsdesk_notify_admins($1) AS n`, [n])).rows[0].n)
    expect(await notify(0)).toBe(0)
    expect(await notify(3)).toBe(2)
    expect(await notify(1)).toBe(0) // already told today
    const rows = (await db.query<{ user_id: string; message: string; link: string }>(`SELECT user_id, message, link FROM notifications ORDER BY user_id`)).rows
    expect(rows).toEqual([
      { user_id: ADMIN, message: '3 Newsdesk posts are waiting for your approval.', link: '/admin/dashboard' },
      { user_id: ADMIN2, message: '3 Newsdesk posts are waiting for your approval.', link: '/admin/dashboard' },
    ])
    // Yesterday's notice does not stop today's.
    await db.query(`UPDATE notifications SET created_at = now() - interval '2 days'`)
    expect(await notify(1)).toBe(2)
    expect((await db.query(`SELECT 1 FROM notifications WHERE message = '1 Newsdesk post is waiting for your approval.'`)).rows).toHaveLength(2)

    for (const role of ['anon', 'authenticated'] as const) {
      await expect(as(ADMIN, role, () => db.query(`SELECT public.newsdesk_notify_admins(1)`))).rejects.toThrow(/permission denied/)
    }
  })

  it('schedules three runs a day (07:30, 12:30, 17:30 Lagos) with the scheduler sign-in', async () => {
    const job = (await db.query<{ schedule: string; command: string }>(`SELECT schedule, command FROM cron.job WHERE jobname = 'daily-newsdesk'`)).rows[0]
    expect(job.schedule).toBe('30 6,11,16 * * *')
    expect(job.command).toContain('/functions/v1/daily-newsdesk')
    expect(job.command).toContain("'x-cron-token'")
    expect(job.command).toContain('abia_cron_token')
  })
})
