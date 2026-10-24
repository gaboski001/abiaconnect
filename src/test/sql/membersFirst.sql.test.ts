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
const LGA = '00000000-0000-0000-0000-000000000001'
const OTHER_LGA = '00000000-0000-0000-0000-000000000002'
const WELCOME = '00000000-0000-0000-0000-0000000000f1'

const SLUGS = ['general-discussion', 'politics-governance', 'culture-heritage', 'gossip', 'business-commerce', 'relationship']

const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE SCHEMA cron;
  CREATE TABLE cron.jobs (name text PRIMARY KEY, spec text);
  CREATE FUNCTION cron.schedule(_n text, _s text, _c text) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO cron.jobs VALUES (_n, _s) ON CONFLICT (name) DO UPDATE SET spec = _s; SELECT 1::bigint $$;
  CREATE FUNCTION cron.unschedule(_n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.jobs WHERE name = _n; SELECT true $$;
  CREATE FUNCTION public.community_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Africa/Lagos')::date $$;
  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY, display_name text, lga text, created_at timestamptz NOT NULL DEFAULT now() - interval '2 days',
    is_banned boolean DEFAULT false, is_deleted boolean DEFAULT false
  );
  CREATE TABLE public.user_roles (user_id uuid, role text, created_at timestamptz NOT NULL DEFAULT now());
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u) $$;
  CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text, is_active boolean DEFAULT true);
  CREATE TABLE public.newsdesk_settings (
    id boolean PRIMARY KEY, author_id uuid, default_forum_limit integer NOT NULL DEFAULT 2,
    forum_limits jsonb NOT NULL DEFAULT '{"general-discussion": 3, "politics-governance": 3, "culture-heritage": 3, "gossip": 3, "relationship": 0}',
    updated_at timestamptz
  );
  CREATE TABLE public.newsdesk_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_date date NOT NULL, category_slug text NOT NULL, status text NOT NULL DEFAULT 'published'
  );
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

  INSERT INTO public.categories (name, slug) SELECT s, s FROM unnest(ARRAY['${SLUGS.join("','")}']) AS s;
  INSERT INTO public.newsdesk_settings (id, author_id) VALUES (true, '${DESK}');
  INSERT INTO public.profiles (id, display_name, lga) VALUES
    ('${CHINEDU}', 'Onyejiuba Chinedu Emmanuel', 'Aba North'), ('${ADA}', 'Nwosu Ada', 'Aba North'),
    ('${OBI}', 'Obi Okeke', 'Bende'), ('${DESK}', 'AbiaConnect Desk', NULL), ('${ADMIN}', 'Admin', NULL);
  INSERT INTO public.user_roles (user_id, role) VALUES ('${ADMIN}', 'Super Admin');
  INSERT INTO public.subgroups (id, name, kind, lga) VALUES
    ('${LGA}', 'Aba North LGA', 'lga', 'Aba North'), ('${OTHER_LGA}', 'Bende LGA', 'lga', 'Bende');
  INSERT INTO public.threads (id, subgroup_id, user_id, title, tags, created_at)
    VALUES ('${WELCOME}', '${LGA}', '${ADMIN}', 'Nnọọ, ndị Aba North!', ARRAY['welcome'], now() - interval '5 days');
`
const read = (f: string) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8')
const BEFORE = ['20261020150000_desk_welcomes.sql', '20261024120000_desk_welcome_names.sql'].map(read)
const MIGRATION = read('20261025090000_members_first.sql')

async function setUp() {
  const db = new PGlite()
  await db.exec(PRELUDE)
  for (const sql of BEFORE) await db.exec(sql)
  await db.exec(MIGRATION)
  return db
}
const as = async <T>(db: PGlite, uid: string, fn: () => Promise<T>) => {
  await db.exec(`SET request.jwt.claim.sub = '${uid}'`)
  try {
    return await fn()
  } finally {
    await db.exec('RESET request.jwt.claim.sub')
  }
}
const limits = async (db: PGlite) =>
  (await db.query<{ forum_limits: Record<string, number> }>('SELECT forum_limits FROM public.newsdesk_settings')).rows[0].forum_limits
const total = (l: Record<string, number>) => Object.values(l).reduce((a, b) => a + b, 0)

describe('members first', () => {
  it('lets the Newsdesk post 3 times a day in all, in the forums it was allowed, taking turns', async () => {
    const db = await setUp()
    let l = await limits(db)
    expect(total(l)).toBe(3)
    // Only forums it was allowed in (relationship was 0; business had the default 2).
    expect(l.relationship).toBe(0)
    for (const slug of SLUGS) expect([0, 1]).toContain(l[slug])

    // Forums it posted in yesterday wait their turn; a forum already posted in today keeps its posts.
    await db.exec(`INSERT INTO public.newsdesk_posts (run_date, category_slug) VALUES
      (public.community_today() - 1, 'general-discussion'), (public.community_today() - 1, 'politics-governance'),
      (public.community_today(), 'gossip')`)
    await db.exec('SELECT public.newsdesk_plan_today()')
    l = await limits(db)
    expect(total(l)).toBe(3)
    expect(l.gossip).toBe(1)
    expect(l['culture-heritage'] + l['business-commerce']).toBe(2)

    // Members can't change the plan; the admin can lower the number.
    await expect(as(db, CHINEDU, () => db.exec('SELECT public.newsdesk_plan_today()'))).rejects.toThrow(/Admins only/)
    await db.exec('UPDATE public.newsdesk_settings SET daily_total = 1')
    await as(db, ADMIN, () => db.exec('SELECT public.newsdesk_plan_today()'))
    expect(total(await limits(db))).toBe(1)
  })

  it('tells champions about every introduction in their group', async () => {
    const db = await setUp()
    await as(db, ADMIN, () => db.exec(`SELECT public.admin_set_group_champion('${LGA}', '${ADA}', true)`))
    // A champion joins the group and is told why.
    expect((await db.query(`SELECT 1 FROM public.subgroup_members WHERE user_id = '${ADA}'`)).rows).toHaveLength(1)
    expect((await db.query(`SELECT 1 FROM public.notifications WHERE user_id = '${ADA}' AND type = 'champion'`)).rows).toHaveLength(1)
    await expect(as(db, CHINEDU, () => db.exec(`SELECT public.admin_set_group_champion('${LGA}', '${CHINEDU}', true)`))).rejects.toThrow(/Admins only/)

    // Ada hasn't been active lately, but as champion she still hears about Chinedu.
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('${WELCOME}', '${CHINEDU}', 'Hello everyone, my name is Chinedu')`)
    const told = await db.query<{ message: string }>(`SELECT message FROM public.notifications WHERE user_id = '${ADA}' AND type = 'welcome_neighbour'`)
    expect(told.rows).toHaveLength(1)
    expect(told.rows[0].message).toContain('Chinedu just introduced themselves in Aba North LGA')
  })

  it('alerts champions and admins about a member post nobody has answered, once', async () => {
    const db = await setUp()
    await as(db, ADMIN, () => db.exec(`SELECT public.admin_set_group_champion('${LGA}', '${ADA}', true)`))
    // Chinedu (Aba North) asks in the open forum; Obi's question was answered; the Newsdesk's post doesn't count.
    await db.exec(`INSERT INTO public.threads (id, user_id, author_id, title, created_at) VALUES
      ('00000000-0000-0000-0000-0000000000e1', '${CHINEDU}', '${CHINEDU}', 'Where can I buy good fabric in Aba?', now() - interval '3 hours'),
      ('00000000-0000-0000-0000-0000000000e2', '${OBI}', '${OBI}', 'Bende road update', now() - interval '3 hours'),
      ('00000000-0000-0000-0000-0000000000e3', '${DESK}', '${DESK}', 'News: budget passed', now() - interval '3 hours')`)
    await db.exec(`INSERT INTO public.replies (thread_id, user_id, content) VALUES ('00000000-0000-0000-0000-0000000000e2', '${ADA}', 'Thanks Obi')`)

    // The list for the admin and the champion.
    const waiting = await as(db, ADMIN, () => db.query<{ title: string; author_name: string }>('SELECT * FROM public.posts_waiting_for_reply(10)'))
    expect(waiting.rows.map((r) => r.title)).toEqual(['Where can I buy good fabric in Aba?'])
    expect(waiting.rows[0].author_name).toBe('Onyejiuba Chinedu Emmanuel')
    const forMember = await as(db, OBI, () => db.query('SELECT * FROM public.posts_waiting_for_reply(10)'))
    expect(forMember.rows).toHaveLength(0)

    await db.exec('SELECT public.alert_unanswered_posts()')
    const alerts = await db.query<{ user_id: string; link: string }>(`SELECT user_id, link FROM public.notifications WHERE type = 'reply_needed' ORDER BY user_id`)
    expect(alerts.rows.map((a) => a.user_id)).toEqual([ADMIN, ADA].sort())
    expect(alerts.rows[0].link).toBe('/thread/00000000-0000-0000-0000-0000000000e1')

    await db.exec('SELECT public.alert_unanswered_posts()')
    expect((await db.query(`SELECT 1 FROM public.notifications WHERE type = 'reply_needed'`)).rows).toHaveLength(2)
  })

  it('is safe to run twice', async () => {
    const db = await setUp()
    await db.exec(MIGRATION)
    expect(total(await limits(db))).toBe(3)
    const jobs = await db.query<{ name: string }>('SELECT name FROM cron.jobs ORDER BY name')
    expect(jobs.rows.map((j) => j.name)).toEqual(['newsdesk-plan', 'unanswered-alerts'])
  })
})
