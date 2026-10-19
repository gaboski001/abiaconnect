// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

/** Stand-ins for the live tables and helpers the newcomer migration builds on. */
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE SCHEMA cron;
  CREATE FUNCTION cron.schedule(a text, b text, c text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
  CREATE FUNCTION cron.unschedule(a text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no such job'; END $$;

  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY, display_name text, username text, lga text, avatar_url text,
    is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _u) $$;
  CREATE TABLE public.subgroups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, category text,
    created_by uuid, is_private boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true,
    rules text[] NOT NULL DEFAULT '{}'
  );
  CREATE TABLE public.subgroup_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid NOT NULL, user_id uuid NOT NULL,
    UNIQUE (subgroup_id, user_id)
  );
  CREATE TABLE public.threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, author_id uuid, user_id uuid,
    subgroup_id uuid, is_deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, user_id uuid);
  CREATE TABLE public.poll_votes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid, user_id uuid);
  CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL,
    message text, link text, is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.member_stats (user_id uuid PRIMARY KEY, points integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.points_ledger (
    id bigserial PRIMARY KEY, user_id uuid NOT NULL, amount integer NOT NULL, reason text NOT NULL,
    ref_id text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, reason, ref_id)
  );
  CREATE TABLE public.member_badges (user_id uuid, badge text, PRIMARY KEY (user_id, badge));
  CREATE FUNCTION public.award_points(_user uuid, _amount integer, _reason text, _ref text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO public.points_ledger (user_id, amount, reason, ref_id) VALUES (_user, _amount, _reason, _ref)
    ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN RETURN 0; END IF;
    RETURN _amount;
  END $$;
  CREATE FUNCTION public.is_subgroup_member(_g uuid, _u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.subgroup_members WHERE subgroup_id = _g AND user_id = _u) $$;
  INSERT INTO public.subgroups (name, category) VALUES ('Abia Tech Hub', 'Technology'), ('Secret Circle', 'Business');
  UPDATE public.subgroups SET is_private = true WHERE name = 'Secret Circle';
`

const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261019120000_newcomer_journey.sql'), 'utf8')
const PRIVATE_TOPICS = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261019170000_private_group_topics.sql'), 'utf8')

async function makeDb() {
  const pg = new PGlite()
  await pg.exec(PRELUDE)
  await pg.exec(MIGRATION)
  await pg.exec(PRIVATE_TOPICS)
  const query = async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows
  const one = async <T>(sql: string, params: unknown[] = []) => (await query<T>(sql, params))[0]!
  /** Runs SQL as a signed-in member (row rules apply). */
  const as = async <T>(uid: string | null, fn: () => Promise<T>) => {
    await pg.exec(`SET request.jwt.claim.sub = '${uid ?? ''}'; SET ROLE ${uid ? 'authenticated' : 'anon'};`)
    try {
      return await fn()
    } finally {
      await pg.exec(`RESET ROLE; RESET request.jwt.claim.sub;`)
    }
  }
  const addUser = async (lga: string, daysAgo = 0, name = 'Member') =>
    (
      await one<{ id: string }>(
        `INSERT INTO profiles (id, display_name, lga, created_at) VALUES (gen_random_uuid(), $1, $2, now() - make_interval(days => $3)) RETURNING id`,
        [name, lga, daysAgo],
      )
    ).id
  return { pg, query, one, as, addUser }
}

type Db = Awaited<ReturnType<typeof makeDb>>

describe('newcomer journey', () => {
  let db: Db
  beforeEach(async () => {
    db = await makeDb()
  })

  it('is safe to run twice, with one group per LGA and topics in every group', async () => {
    await db.pg.exec(MIGRATION)
    const groups = await db.one<{ lga: number; total: number }>(
      `SELECT count(*) FILTER (WHERE kind = 'lga')::int AS lga, count(*)::int AS total FROM subgroups`,
    )
    expect(groups.lga).toBe(17)
    const bare = await db.one<{ n: number }>(
      `SELECT count(*)::int AS n FROM subgroups s WHERE NOT EXISTS (SELECT 1 FROM subgroup_topics t WHERE t.subgroup_id = s.id)`,
    )
    expect(bare.n).toBe(0)
  })

  it('welcomes a new member, joins only public groups, and asks active neighbours to say hi', async () => {
    const veteran = await db.addUser('Umuahia North', 200, 'Ada Okoro')
    await db.query(`INSERT INTO member_stats (user_id, points) VALUES ($1, 400)`, [veteran])
    const chidi = await db.addUser('Umuahia North', 0, 'Chidi Okafor')
    const ids = await db.query<{ id: string }>(
      `SELECT id FROM subgroups WHERE (kind = 'lga' AND lga = 'Umuahia North') OR name IN ('Abia Tech Hub', 'Secret Circle')`,
    )
    const result = await db.as(chidi, () =>
      db.one<{ r: { joined: number; greeted: number } }>(`SELECT complete_welcome(ARRAY['tech'], $1::uuid[]) AS r`, [ids.map((g) => g.id)]),
    )
    expect(result.r).toMatchObject({ joined: 2, greeted: 1 })
    const toVeteran = await db.one<{ message: string }>(`SELECT message FROM notifications WHERE user_id = $1`, [veteran])
    expect(toVeteran.message).toContain('Chidi Okafor from Umuahia North just joined')

    // Doing it again doesn't send the greetings twice.
    await db.as(chidi, () => db.query(`SELECT complete_welcome(ARRAY['tech'], '{}')`))
    expect((await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1`, [veteran])).n).toBe(1)
  })

  it('pays the 50-point bonus and badge only after all 5 steps, and only once', async () => {
    const chidi = await db.addUser('Bende')
    const group = await db.one<{ id: string }>(`SELECT id FROM subgroups WHERE kind = 'lga' AND lga = 'Bende'`)
    await db.as(chidi, () => db.query(`SELECT complete_welcome(ARRAY['culture'], ARRAY[$1]::uuid[])`, [group.id]))
    await expect(db.as(chidi, () => db.query(`SELECT claim_starter_bonus()`))).rejects.toThrow(/all 5 steps/)

    await db.query(`INSERT INTO poll_votes (user_id) VALUES ($1)`, [chidi])
    await db.query(`INSERT INTO replies (user_id) VALUES ($1)`, [chidi])
    await db.query(`UPDATE profiles SET avatar_url = 'me.jpg' WHERE id = $1`, [chidi])
    expect((await db.as(chidi, () => db.one<{ p: number }>(`SELECT claim_starter_bonus() AS p`))).p).toBe(50)
    expect((await db.as(chidi, () => db.one<{ p: number }>(`SELECT claim_starter_bonus() AS p`))).p).toBe(0)
    expect((await db.one<{ badge: string }>(`SELECT badge FROM member_badges WHERE user_id = $1`, [chidi])).badge).toBe('new_abian')
  })

  it('drops a topic that belongs to a different group', async () => {
    const tech = await db.one<{ id: string }>(`SELECT id FROM subgroups WHERE name = 'Abia Tech Hub'`)
    const other = await db.one<{ id: string }>(`SELECT id FROM subgroups WHERE kind = 'lga' LIMIT 1`)
    const topic = await db.one<{ id: string }>(`SELECT id FROM subgroup_topics WHERE subgroup_id = $1 LIMIT 1`, [tech.id])
    const kept = await db.one<{ topic_id: string | null }>(
      `INSERT INTO threads (title, subgroup_id, topic_id) VALUES ('x', $1, $2) RETURNING topic_id`,
      [other.id, topic.id],
    )
    expect(kept.topic_id).toBeNull()
  })

  it('lets only admins change topics, and everyone read them', async () => {
    const member = await db.addUser('Ohafia')
    const admin = await db.addUser('Ohafia')
    await db.query(`INSERT INTO admins VALUES ($1)`, [admin])
    const group = await db.one<{ id: string }>(`SELECT id FROM subgroups WHERE name = 'Abia Tech Hub'`)
    await expect(
      db.as(member, () => db.query(`INSERT INTO subgroup_topics (subgroup_id, name) VALUES ($1, 'Spam')`, [group.id])),
    ).rejects.toThrow()
    await db.as(admin, () => db.query(`INSERT INTO subgroup_topics (subgroup_id, name) VALUES ($1, 'Hiring')`, [group.id]))
    const seen = await db.as(null, () => db.query(`SELECT id FROM subgroup_topics WHERE name = 'Hiring'`))
    expect(seen).toHaveLength(1)
  })

  it('hides the topics of private groups from outsiders, but not from members', async () => {
    const outsider = await db.addUser('Bende')
    const insider = await db.addUser('Bende')
    const secret = await db.one<{ id: string }>(`SELECT id FROM subgroups WHERE name = 'Secret Circle'`)
    await db.query(`INSERT INTO subgroup_members (subgroup_id, user_id) VALUES ($1, $2)`, [secret.id, insider])
    const look = (uid: string | null) =>
      db.as(uid, () => db.query(`SELECT id FROM subgroup_topics WHERE subgroup_id = $1`, [secret.id]))
    expect(await look(null)).toHaveLength(0)
    expect(await look(outsider)).toHaveLength(0)
    expect((await look(insider)).length).toBeGreaterThan(0)
    const tech = await db.one<{ id: string }>(`SELECT id FROM subgroups WHERE name = 'Abia Tech Hub'`)
    expect((await db.as(null, () => db.query(`SELECT id FROM subgroup_topics WHERE subgroup_id = $1`, [tech.id]))).length).toBeGreaterThan(0)
  })

  it('sends each week-one reminder once, and none after the bonus', async () => {
    const quiet = await db.addUser('Isuikwuato', 4)
    const busy = await db.addUser('Isuikwuato', 4)
    await db.query(`INSERT INTO points_ledger (user_id, amount, reason, ref_id) VALUES ($1, 50, 'starter_bonus', 'starter')`, [busy])
    expect((await db.one<{ n: number }>(`SELECT send_newcomer_nudges() AS n`)).n).toBe(1)
    expect((await db.one<{ n: number }>(`SELECT send_newcomer_nudges() AS n`)).n).toBe(0)
    expect((await db.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'nudge'`, [quiet])).length).toBe(1)
  })

  it('shows the newcomer numbers to admins only', async () => {
    const member = await db.addUser('Arochukwu')
    const admin = await db.addUser('Arochukwu')
    await db.query(`INSERT INTO admins VALUES ($1)`, [admin])
    await expect(db.as(member, () => db.query(`SELECT newcomer_funnel(30)`))).rejects.toThrow(/Admins only/)
    const funnel = await db.as(admin, () => db.one<{ f: { joined: number } }>(`SELECT newcomer_funnel(30) AS f`))
    expect(funnel.f.joined).toBe(2)
  })

  it('keeps the reminder log away from members', async () => {
    const member = await db.addUser('Ikwuano')
    await expect(db.as(member, () => db.query(`SELECT * FROM newcomer_nudges`))).rejects.toThrow(/permission denied/)
  })
})
