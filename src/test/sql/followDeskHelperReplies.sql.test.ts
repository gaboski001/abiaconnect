// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text, username text,
    avatar_url text, bio text, occupation text, current_location text, lga text,
    is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false);
  GRANT SELECT ON public.profiles TO authenticated;
  CREATE TABLE public.user_roles (user_id uuid, role text);
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role IN ('Admin', 'Super Admin')) $$;
  GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
  CREATE TABLE public.connect_follows (follower_id uuid NOT NULL, followed_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, followed_id));
  CREATE TABLE public.newsdesk_settings (id boolean PRIMARY KEY, author_id uuid,
    review_slugs text[] NOT NULL DEFAULT ARRAY['politics-governance']);
  CREATE FUNCTION public.newsdesk_author_id() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT author_id FROM public.newsdesk_settings WHERE id $$;
  CREATE FUNCTION public.desk_account() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT public.newsdesk_author_id() $$;
  CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text);
  CREATE TABLE public.subgroups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
  CREATE FUNCTION public.lga_group_for(_lga text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE TABLE public.group_champions (subgroup_id uuid, user_id uuid);
  CREATE TABLE public.unanswered_alerts (thread_id uuid PRIMARY KEY);
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text,
    message text, link text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid, subgroup_id uuid,
    user_id uuid, author_id uuid, title text NOT NULL DEFAULT 'A post', content text, tags text[] DEFAULT '{}',
    is_anonymous boolean NOT NULL DEFAULT false, allow_replies boolean DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, user_id uuid,
    content text, created_at timestamptz NOT NULL DEFAULT now());
`

describe('Follows, Newsdesk turns and helper replies', () => {
  let db: PGlite
  const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0]
  const rows = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows
  const person = async (name: string) =>
    (await one<{ id: string }>(`INSERT INTO profiles (display_name, username) VALUES ($1, $2) RETURNING id`, [name, name.split(' ')[0].toLowerCase()]))!.id
  const as = async <T,>(uid: string | null, fn: () => Promise<T>) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
    if (!uid) return fn()
    await db.query('SET ROLE authenticated')
    try {
      return await fn()
    } finally {
      await db.query('RESET ROLE')
    }
  }

  let gabby: string, desk: string, ada: string, chi: string, helper1: string, helper2: string, general: string, politics: string
  beforeEach(async () => {
    db = await PGlite.create()
    await db.exec(PRELUDE)
    gabby = await person('Gabby')
    desk = await person('Old Desk Name')
    ada = await person('Ada Obi')
    chi = await person('Chi Eze')
    await db.query(`INSERT INTO user_roles VALUES ($1, 'Super Admin')`, [gabby])
    await db.query(`INSERT INTO newsdesk_settings VALUES (true, $1)`, [desk])
    general = (await one<{ id: string }>(`INSERT INTO categories (name, slug) VALUES ('General Discussion', 'general-discussion') RETURNING id`))!.id
    politics = (await one<{ id: string }>(`INSERT INTO categories (name, slug) VALUES ('Politics', 'politics-governance') RETURNING id`))!.id
    // follow_main_admin_on_join from the birthday migration
    await db.exec(`CREATE FUNCTION public.follow_main_admin_on_join() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
      CREATE TRIGGER follow_main_admin_on_join AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.follow_main_admin_on_join();`)
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261109180000_follow_desk_and_helper_replies.sql'), 'utf8'))
    helper1 = await person('Helper One')
    helper2 = await person('Helper Two')
  })

  it('every member follows @Gabby and the Newsdesk, now and when they join', async () => {
    const followers = async (id: string) =>
      (await rows<{ follower_id: string }>(`SELECT follower_id FROM connect_follows WHERE followed_id = $1`, [id])).map((r) => r.follower_id).sort()
    expect(await followers(gabby)).toEqual([desk, ada, chi, helper1, helper2].sort())
    expect(await followers(desk)).toEqual([gabby, ada, chi, helper1, helper2].sort())
  })

  it('the Newsdesk profile is tidied up', async () => {
    const p = await one<{ display_name: string; avatar_url: string; current_location: string }>(`SELECT * FROM profiles WHERE id = $1`, [desk])
    expect(p).toMatchObject({ display_name: 'AbiaConnect Newsdesk', avatar_url: 'https://abiaconnect.com/newsdesk-avatar.png', current_location: 'Umuahia, Abia State' })
  })

  it('Newsdesk posts take turns with @Gabby, but not in sensitive forums, welcome posts or a member’s own post', async () => {
    const post = async (cat: string, tags = '{}') =>
      (await one<{ author_id: string }>(
        `INSERT INTO threads (category_id, user_id, author_id, tags) VALUES ($1, $2, $2, $3) RETURNING author_id`,
        [cat, desk, tags],
      ))!.author_id
    expect([await post(general), await post(general), await post(general), await post(general)]).toEqual([desk, gabby, desk, gabby])
    expect(await post(politics)).toBe(desk)
    expect(await post(general, '{welcome}')).toBe(desk)
    // The Newsdesk account posting by hand (signed in) is left alone.
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [desk])
    expect(await post(general)).toBe(desk)
  })

  describe('helper replies', () => {
    beforeEach(async () => {
      // Daytime in Lagos, whenever the tests run.
      await db.exec(`CREATE OR REPLACE FUNCTION public.helper_replies_resting() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$`)
      await db.query(`INSERT INTO helper_reply_accounts (user_id) VALUES ($1), ($2)`, [helper1, helper2])
    })
    const thread = async (author: string, minutesAgo: number, cat = general) =>
      (await one<{ id: string }>(
        `INSERT INTO threads (category_id, user_id, author_id, created_at) VALUES ($1, $2, $2, now() - make_interval(mins => $3)) RETURNING id`,
        [cat, author, minutesAgo],
      ))!.id

    it('stay off until an admin switches them on', async () => {
      await thread(ada, 60)
      expect((await one<{ n: number }>(`SELECT run_helper_replies() AS n`))!.n).toBe(0)
      expect(await one(`SELECT 1 FROM replies`)).toBeUndefined()
    })

    it('reply by first name, at most twice per post, never too soon, never in sensitive forums', async () => {
      await as(gabby, () => db.query(`SELECT admin_set_helper_replies(true)`))
      const fresh = await thread(ada, 10)
      const hourOld = await thread(ada, 60)
      const dayOld = await thread(chi, 60 * 5)
      await thread(ada, 60, politics)
      await db.query(`SELECT run_helper_replies()`)
      const first = await rows<{ thread_id: string; content: string }>(`SELECT thread_id, content FROM replies`)
      expect(first.map((r) => r.thread_id).sort()).toEqual([hourOld, dayOld].sort())
      expect(first.find((r) => r.thread_id === hourOld)!.content).toContain('Ada')
      expect(first.every((r) => r.content.startsWith('<p>'))).toBe(true)

      await db.query(`SELECT run_helper_replies()`)
      await db.query(`SELECT run_helper_replies()`)
      const counts = await rows<{ thread_id: string; n: number; people: number }>(
        `SELECT thread_id, count(*)::int AS n, count(DISTINCT user_id)::int AS people FROM replies GROUP BY thread_id`,
      )
      // The hour-old post waits for a second helper; the five-hour-old one gets two different helpers.
      expect(counts.find((c) => c.thread_id === hourOld)!.n).toBe(1)
      expect(counts.find((c) => c.thread_id === dayOld)).toMatchObject({ n: 2, people: 2 })
      expect(counts.find((c) => c.thread_id === fresh)).toBeUndefined()
    })

    it('a helper never answers their own post, and helper replies still leave the post as “no reply yet”', async () => {
      await as(gabby, () => db.query(`SELECT admin_set_helper_replies(true)`))
      await db.query(`DELETE FROM helper_reply_accounts WHERE user_id = $1`, [helper2])
      const own = await thread(helper1, 60)
      const ada1 = await thread(ada, 60 * 3)
      await db.query(`SELECT run_helper_replies()`)
      expect(await one(`SELECT 1 FROM replies WHERE thread_id = $1`, [own])).toBeUndefined()
      expect(await one(`SELECT 1 FROM replies WHERE thread_id = $1`, [ada1])).toBeTruthy()
      const waiting = await rows<{ id: string }>(`SELECT id FROM unanswered_member_threads(interval '2 days')`)
      expect(waiting.map((w) => w.id)).toContain(ada1)
    })

    it('admins see and manage it; members cannot', async () => {
      await as(gabby, () => db.query(`SELECT admin_helper_reply_account($1, false)`, [helper2]))
      const view = await as(gabby, () => one<{ v: { enabled: boolean; accounts: { name: string }[] } }>(`SELECT admin_helper_replies() AS v`))
      expect(view!.v.enabled).toBe(false)
      expect(view!.v.accounts.map((a) => a.name)).toEqual(['Helper One'])
      let msg = ''
      try {
        await as(ada, () => db.query(`SELECT admin_set_helper_replies(true)`))
      } catch (e) {
        msg = (e as Error).message
      }
      expect(msg).toContain('admins_only')
    })
  })
})
