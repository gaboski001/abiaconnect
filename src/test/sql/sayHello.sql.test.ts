// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const DESK = '00000000-0000-0000-0000-00000000000d'
const ADMIN = '00000000-0000-0000-0000-00000000000a'
const CHINEDU = '00000000-0000-0000-0000-0000000000c1'
const ADA = '00000000-0000-0000-0000-0000000000c2'
const OBI = '00000000-0000-0000-0000-0000000000c3'
const OLD = '00000000-0000-0000-0000-0000000000c4'
const LGA = '00000000-0000-0000-0000-000000000001'
const WELCOME = '00000000-0000-0000-0000-0000000000f1'
const STRAY = '00000000-0000-0000-0000-0000000000f2'
const CAT = '00000000-0000-0000-0000-0000000000ca'

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA cron;
  CREATE TABLE cron.jobs (name text PRIMARY KEY, spec text, command text);
  CREATE FUNCTION cron.schedule(_n text, _s text, _c text) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO cron.jobs VALUES (_n, _s, _c) ON CONFLICT (name) DO UPDATE SET spec = _s; SELECT 1::bigint $$;
  CREATE FUNCTION cron.unschedule(_n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.jobs WHERE name = _n; SELECT true $$;
  CREATE FUNCTION public.community_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Africa/Lagos')::date $$;
  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY, display_name text, lga text, created_at timestamptz NOT NULL DEFAULT now() - interval '2 days',
    is_banned boolean DEFAULT false, is_deleted boolean DEFAULT false
  );
  CREATE TABLE public.user_roles (user_id uuid, role text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.newsdesk_settings (id boolean PRIMARY KEY, author_id uuid);
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u) $$;
  CREATE TABLE public.categories (id uuid PRIMARY KEY, name text, slug text);
  CREATE TABLE public.subgroups (
    id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL DEFAULT 'interest', lga text,
    is_private boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true
  );
  CREATE FUNCTION public.lga_group_for(_lga text) RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT id FROM public.subgroups WHERE kind = 'lga' AND lga = _lga LIMIT 1 $$;
  CREATE TABLE public.subgroup_members (subgroup_id uuid, user_id uuid, PRIMARY KEY (subgroup_id, user_id));
  CREATE TABLE public.subgroup_topics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid, name text);
  CREATE TABLE public.threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid, subgroup_id uuid, topic_id uuid, user_id uuid, author_id uuid,
    title text NOT NULL, content text, tags text[] DEFAULT '{}', is_anonymous boolean NOT NULL DEFAULT false,
    allow_replies boolean DEFAULT true, is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, user_id uuid, parent_reply_id uuid,
    content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL, message text, link text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.points_ledger (
    id bigint GENERATED ALWAYS AS IDENTITY, user_id uuid, amount integer, reason text, ref_id text,
    day date NOT NULL DEFAULT public.community_today(), created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.member_stats (user_id uuid PRIMARY KEY, current_streak integer DEFAULT 0, last_checkin date);
  CREATE TABLE public.newcomer_nudges (user_id uuid, stage integer, sent_at timestamptz DEFAULT now(), PRIMARY KEY (user_id, stage));

  INSERT INTO public.categories VALUES ('${CAT}', 'General Discussion', 'general-discussion');
  INSERT INTO public.profiles (id, display_name, lga) VALUES
    ('${CHINEDU}', 'Onyejiuba Chinedu Emmanuel', 'Aba North'), ('${ADA}', 'Nwosu Ada', 'Aba North'),
    ('${OBI}', 'Obi Okeke', 'Aba North'), ('${DESK}', 'AbiaConnect Desk', NULL), ('${ADMIN}', 'Admin', NULL);
  INSERT INTO public.profiles (id, display_name, lga, created_at) VALUES ('${OLD}', 'Old Member', 'Aba North', now() - interval '90 days');
  INSERT INTO public.newsdesk_settings VALUES (true, '${DESK}');
  INSERT INTO public.user_roles (user_id, role) VALUES ('${ADMIN}', 'Super Admin');
  INSERT INTO public.subgroups (id, name, kind, lga) VALUES ('${LGA}', 'Aba North LGA', 'lga', 'Aba North');
  INSERT INTO public.subgroup_topics (subgroup_id, name) VALUES ('${LGA}', 'Introduce yourself');
  INSERT INTO public.threads (id, subgroup_id, user_id, title, tags, created_at)
    VALUES ('${WELCOME}', '${LGA}', '${ADMIN}', 'Nnọọ, ndị Aba North!', ARRAY['welcome'], now() - interval '5 days');
`
const read = (f: string) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8')
const DESK_WELCOMES = read('20261020150000_desk_welcomes.sql')
const NAMES = read('20261024120000_desk_welcome_names.sql')
const MIGRATION = read('20261024150000_one_place_to_say_hello.sql')

async function setUp() {
  const db = new PGlite()
  await db.exec(PRELUDE)
  await db.exec(DESK_WELCOMES)
  await db.exec(NAMES)
  return db
}

describe('one place to say hello', () => {
  it('moves an introduction posted as its own thread onto the welcome thread, with the Desk welcome under it', async () => {
    const db = await setUp()
    await db.exec(`INSERT INTO public.threads (id, subgroup_id, topic_id, user_id, author_id, title, content)
      SELECT '${STRAY}', '${LGA}', id, '${CHINEDU}', '${CHINEDU}', 'Introduction', '<p>Hello everyone, my name is chinedu.</p>'
        FROM public.subgroup_topics LIMIT 1`)
    await db.exec(`INSERT INTO public.points_ledger (user_id, amount, reason, ref_id) VALUES ('${CHINEDU}', 15, 'thread', '${STRAY}')`)
    // The Desk welcomed him on his own thread.
    expect((await db.query(`SELECT 1 FROM public.replies WHERE thread_id = '${STRAY}' AND user_id = '${DESK}'`)).rows).toHaveLength(1)

    await db.exec(MIGRATION)

    const stray = await db.query<{ is_deleted: boolean }>(`SELECT is_deleted FROM public.threads WHERE id = '${STRAY}'`)
    expect(stray.rows[0].is_deleted).toBe(true)
    const onWelcome = await db.query<{ id: string; user_id: string; parent_reply_id: string | null; content: string }>(
      `SELECT id, user_id, parent_reply_id, content FROM public.replies WHERE thread_id = '${WELCOME}' ORDER BY created_at`,
    )
    const intro = onWelcome.rows.find((r) => r.user_id === CHINEDU)!
    const deskReply = onWelcome.rows.find((r) => r.user_id === DESK)!
    expect(intro.content).toContain('my name is chinedu')
    expect(deskReply.parent_reply_id).toBe(intro.id)
    expect(onWelcome.rows).toHaveLength(2)
    // He keeps his points: the ledger no longer counts it as a removed post.
    const ledger = await db.query(`SELECT 1 FROM public.points_ledger WHERE reason = 'thread' AND ref_id = '${STRAY}'`)
    expect(ledger.rows).toHaveLength(0)

    // Running it again changes nothing.
    await db.exec(MIGRATION)
    expect((await db.query(`SELECT 1 FROM public.replies WHERE thread_id = '${WELCOME}'`)).rows).toHaveLength(2)
  })

  it('leaves introductions others have already answered where they are', async () => {
    const db = await setUp()
    await db.exec(`INSERT INTO public.threads (id, subgroup_id, user_id, author_id, title, content)
      VALUES ('${STRAY}', '${LGA}', '${CHINEDU}', '${CHINEDU}', 'Hello everyone', 'My name is Chinedu')`)
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('${STRAY}', '${ADA}', 'Welcome Chinedu!')`)
    await db.exec(MIGRATION)
    const stray = await db.query<{ is_deleted: boolean }>(`SELECT is_deleted FROM public.threads WHERE id = '${STRAY}'`)
    expect(stray.rows[0].is_deleted).toBe(false)
  })

  it('asks active group members to greet a newcomer, at most twice a day each', async () => {
    const db = await setUp()
    await db.exec(MIGRATION)
    await db.exec(`INSERT INTO public.subgroup_members VALUES ('${LGA}', '${ADA}'), ('${LGA}', '${OBI}'), ('${LGA}', '${CHINEDU}')`)
    // Ada was active this week; Obi wasn't.
    await db.exec(`INSERT INTO public.points_ledger (user_id, amount, reason, ref_id) VALUES ('${ADA}', 5, 'reply', 'x')`)
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('${WELCOME}', '${CHINEDU}', 'Hello everyone, my name is Chinedu')`)
    const asked = await db.query<{ user_id: string; message: string; link: string }>(
      `SELECT user_id, message, link FROM public.notifications WHERE type = 'welcome_neighbour'`,
    )
    expect(asked.rows.map((r) => r.user_id)).toEqual([ADA])
    expect(asked.rows[0].message).toContain('Chinedu just introduced themselves in Aba North LGA')
    expect(asked.rows[0].link).toBe(`/thread/${WELCOME}`)
  })

  it('posts one question of the day, and sends each member at most one reminder a day', async () => {
    const db = await setUp()
    await db.exec(MIGRATION)
    const q = await db.query<{ title: string; user_id: string }>(
      `SELECT title, user_id FROM public.threads WHERE 'question-of-the-day' = ANY (tags)`,
    )
    expect(q.rows).toHaveLength(1)
    expect(q.rows[0].title).toMatch(/^Question of the day: /)
    expect(q.rows[0].user_id).toBe(DESK)
    // A second run the same day posts nothing new.
    await db.exec('SELECT public.post_question_of_the_day()')
    expect((await db.query(`SELECT 1 FROM public.threads WHERE 'question-of-the-day' = ANY (tags)`)).rows).toHaveLength(1)

    // Ada was in today; Obi has a streak about to break; the old member has been away for 5 days.
    await db.exec(`INSERT INTO public.points_ledger (user_id, amount, reason, ref_id) VALUES ('${ADA}', 5, 'daily_checkin', '')`)
    await db.exec(`INSERT INTO public.member_stats VALUES ('${OBI}', 4, public.community_today() - 1), ('${OLD}', 0, public.community_today() - 5)`)
    await db.exec('SELECT public.send_daily_nudges()')
    const nudges = await db.query<{ user_id: string; message: string; link: string }>(
      `SELECT user_id, message, link FROM public.notifications WHERE type = 'nudge' ORDER BY user_id`,
    )
    const byUser = new Map(nudges.rows.map((n) => [n.user_id, n]))
    expect(byUser.has(ADA)).toBe(false)
    expect(byUser.has(ADMIN)).toBe(false)
    expect(byUser.get(OBI)!.message).toContain('4-day streak')
    // Chinedu is new and hasn't said hello: he's sent to the welcome post's reply box.
    expect(byUser.get(CHINEDU)!.link).toBe(`/thread/${WELCOME}?hello=1`)
    expect(byUser.get(OLD)!.message).toContain('Today\'s question')

    // Running again the same day sends nothing more.
    await db.exec('SELECT public.send_daily_nudges()')
    expect((await db.query(`SELECT 1 FROM public.notifications WHERE type = 'nudge'`)).rows).toHaveLength(nudges.rows.length)

    const jobs = await db.query<{ name: string }>('SELECT name FROM cron.jobs ORDER BY name')
    expect(jobs.rows.map((j) => j.name)).toEqual(['daily-nudges', 'question-of-the-day'])
  })
})
