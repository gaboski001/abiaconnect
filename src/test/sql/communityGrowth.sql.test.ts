// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

const migration = (f: string) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8')

// The new forum and dashboard rules on the real migration, through the same
// role members use.
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(`
    ALTER TABLE public.relationship_profiles ADD COLUMN looking_for text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS occupation text, ADD COLUMN IF NOT EXISTS current_location text,
      ADD COLUMN IF NOT EXISTS lga text, ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    ALTER TABLE public.relationship_profiles ADD COLUMN IF NOT EXISTS lga text, ADD COLUMN IF NOT EXISTS occupation text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
    CREATE TABLE public.subgroups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, is_private boolean NOT NULL DEFAULT false);
    CREATE TABLE public.subgroup_members (subgroup_id uuid, user_id uuid);
    CREATE TABLE public.threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, user_id uuid, private_author_id uuid, category_id uuid, subgroup_id uuid,
      is_deleted boolean NOT NULL DEFAULT false, is_anonymous boolean NOT NULL DEFAULT false, upvotes int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.replies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid REFERENCES public.threads(id), user_id uuid,
      is_hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.member_stats (user_id uuid PRIMARY KEY, points int NOT NULL DEFAULT 0);
    CREATE TABLE public.member_badges (user_id uuid, badge text, awarded_at timestamptz DEFAULT now());
    CREATE TABLE public.points_log (user_id uuid, amount int, reason text, ref text, UNIQUE (user_id, reason, ref));
    CREATE FUNCTION public.community_today() RETURNS date LANGUAGE sql STABLE AS $$ SELECT now()::date $$;
    CREATE FUNCTION public.points_level(_p int) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN _p >= 100 THEN 2 ELSE 1 END $$;
    CREATE FUNCTION public.award_points(_user uuid, _amount int, _reason text, _ref text) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE n int;
    BEGIN
      INSERT INTO public.points_log VALUES (_user, _amount, _reason, _ref) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      RETURN CASE WHEN n > 0 THEN _amount ELSE 0 END;
    END $$;
    CREATE FUNCTION public.is_public_subgroup(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT EXISTS (SELECT 1 FROM public.subgroups s WHERE s.id = _id AND NOT s.is_private) $$;
    CREATE FUNCTION public.is_subgroup_member(_id uuid, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
      $$ SELECT EXISTS (SELECT 1 FROM public.subgroup_members m WHERE m.subgroup_id = _id AND m.user_id = _user) $$;
  `)
  await db.exec(migration('20261107120000_connect_professional.sql'))
  await db.exec(migration('20261107140000_community_growth.sql'))
  await db.exec(migration('20261107160000_best_answer_no_second_link.sql'))
}, 60_000)

const asMember = <T>(user: string, fn: () => Promise<T>) =>
  db.asRole('authenticated', async () => {
    await db.as(user)
    return fn()
  })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (user: string, sql: string, params: unknown[] = []): Promise<any> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  asMember(user, async () => (await db.one<{ r: any }>(`SELECT ${sql} r`, params)).r)

const newThread = async (author: string, extra: { anonymous?: boolean; group?: string } = {}) => {
  await db.as(null)
  const { id } = await db.one<{ id: string }>(
    `INSERT INTO public.threads (title, user_id, private_author_id, is_anonymous, subgroup_id) VALUES ('Help me', $1, $2, $3, $4) RETURNING id`,
    [extra.anonymous ? null : author, author, !!extra.anonymous, extra.group ?? null],
  )
  return id
}

const addReply = async (thread: string, user: string) => {
  await db.as(null)
  const { id } = await db.one<{ id: string }>(`INSERT INTO public.replies (thread_id, user_id) VALUES ($1, $2) RETURNING id`, [thread, user])
  return id
}

const alerts = async (user: string, type: string) => {
  await db.as(null)
  return (await db.query<{ message: string }>(`SELECT message FROM public.notifications WHERE user_id = $1 AND type = $2`, [user, type])).rows
}

describe('following any member', () => {
  it('works without a Connect profile and links to their public page', async () => {
    const a = await db.addUser({ dating: false })
    const b = await db.addUser({ dating: false })
    expect(await call(a, `public.connect_toggle_follow($1)`, [b])).toMatchObject({ status: 'ok', following: true, followers: 1 })
    await db.as(null)
    const { link } = await db.one<{ link: string }>(`SELECT link FROM public.notifications WHERE user_id = $1 AND type = 'connect_follow'`, [b])
    expect(link).toBe(`/member/${a}`)
  })

  it('still refuses banned and blocked members', async () => {
    const a = await db.addUser({ dating: false })
    const banned = await db.addUser({ dating: false, banned: true })
    const blocker = await db.addUser({ dating: false })
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks (user_id, blocked_id) VALUES ($1, $2)`, [blocker, a])
    expect(await call(a, `public.connect_toggle_follow($1)`, [banned])).toMatchObject({ status: 'unavailable' })
    expect(await call(a, `public.connect_toggle_follow($1)`, [blocker])).toMatchObject({ status: 'unavailable' })
    expect(await call(a, `public.community_member_page($1)`, [blocker])).toBeNull()
  })
})

describe('public page', () => {
  it('keeps dating details on Connect', async () => {
    const viewer = await db.addUser({ dating: false })
    const dating = await db.addUser()
    await db.as(null)
    await db.query(`UPDATE public.relationship_profiles SET looking_for = 'dating', headline = 'Looking for love', photos = ARRAY['https://x/p.jpg'] WHERE user_id = $1`, [dating])
    const page = await call(viewer, `public.community_member_page($1)`, [dating])
    expect(page).toMatchObject({ has_connect: true, looking_for: null, headline: null, photos: [] })
  })

  it('shows work details and photos for work reasons', async () => {
    const viewer = await db.addUser({ dating: false })
    const worker = await db.addUser()
    await db.as(null)
    await db.query(`UPDATE public.relationship_profiles SET looking_for = 'services', services = 'Plumbing', photos = ARRAY['https://x/w.jpg'] WHERE user_id = $1`, [worker])
    expect(await call(viewer, `public.community_member_page($1)`, [worker])).toMatchObject({ looking_for: 'services', services: 'Plumbing', photos: ['https://x/w.jpg'] })
  })
})

describe('follow a discussion', () => {
  it('alerts followers once until read, never the person replying', async () => {
    const author = await db.addUser({ dating: false })
    const fan = await db.addUser({ dating: false })
    const helper = await db.addUser({ dating: false })
    const t = await newThread(author)
    expect(await call(fan, `public.toggle_thread_follow($1)`, [t])).toBe(true)
    expect(await call(fan, `public.thread_community_state($1)`, [t])).toMatchObject({ following: true, is_mine: false })
    await addReply(t, helper)
    await addReply(t, helper)
    expect(await alerts(fan, 'thread_follow')).toHaveLength(1)
    await addReply(t, fan)
    expect(await alerts(fan, 'thread_follow')).toHaveLength(1)
    await db.query(`UPDATE public.notifications SET is_read = true WHERE user_id = $1`, [fan])
    await addReply(t, helper)
    expect(await alerts(fan, 'thread_follow')).toHaveLength(2)
    expect(await call(fan, `public.toggle_thread_follow($1)`, [t])).toBe(false)
  })

  it('refuses private group discussions for outsiders', async () => {
    const author = await db.addUser({ dating: false })
    const outsider = await db.addUser({ dating: false })
    await db.as(null)
    const { id: group } = await db.one<{ id: string }>(`INSERT INTO public.subgroups (name, is_private) VALUES ('Secret', true) RETURNING id`)
    const t = await newThread(author, { group })
    await expect(call(outsider, `public.toggle_thread_follow($1)`, [t])).rejects.toThrow(/not available/)
    expect(await call(outsider, `public.thread_community_state($1)`, [t])).toBeFalsy()
  })
})

describe('best answer', () => {
  it('lets only the asker choose, and pays the helper once', async () => {
    const author = await db.addUser({ dating: false })
    const helper = await db.addUser({ dating: false })
    const t = await newThread(author)
    const r = await addReply(t, helper)
    await expect(call(helper, `public.set_best_answer($1, $2)`, [t, r])).rejects.toThrow(/Only the person/)
    await call(author, `public.set_best_answer($1, $2)`, [t, r])
    await call(author, `public.set_best_answer($1, $2)`, [t, null])
    await call(author, `public.set_best_answer($1, $2)`, [t, r])
    expect(await call(author, `public.thread_community_state($1)`, [t])).toMatchObject({ best_reply_id: r, is_mine: true })
    await db.as(null)
    const { n } = await db.one<{ n: number }>(`SELECT count(*)::int n FROM public.points_log WHERE user_id = $1 AND reason = 'best_answer'`, [helper])
    expect(n).toBe(1)
    expect(await alerts(helper, 'reward')).toHaveLength(1)
  })

  it('refuses your own reply, and works on an anonymous post without naming the asker', async () => {
    const author = await db.addUser({ dating: false })
    const other = await db.addUser({ dating: false })
    const t = await newThread(author, { anonymous: true })
    const own = await addReply(t, author)
    await expect(call(author, `public.set_best_answer($1, $2)`, [t, own])).rejects.toThrow(/own reply/)
    const r = await addReply(t, other)
    await call(author, `public.set_best_answer($1, $2)`, [t, r])
    expect(await call(other, `public.thread_community_state($1)`, [t])).toMatchObject({ is_mine: false, best_reply_id: r })
  })
})

describe('post doing well', () => {
  it('tells the writer once at each milestone', async () => {
    const author = await db.addUser({ dating: false })
    const helper = await db.addUser({ dating: false })
    const t = await newThread(author)
    for (let i = 0; i < 6; i++) await addReply(t, helper)
    expect(await alerts(author, 'post_doing_well')).toHaveLength(1)
    await db.query(`UPDATE public.threads SET upvotes = 5 WHERE id = $1`, [t])
    expect((await alerts(author, 'post_doing_well')).map((a) => a.message).join()).toMatch(/5 likes/)
  })
})

describe('invites', () => {
  it('pays only when the invited member posts, once', async () => {
    const inviter = await db.addUser({ dating: false })
    const invitee = await db.addUser({ dating: false })
    const { code } = await call(inviter, `public.my_invite()`)
    expect(await call(inviter, `public.claim_invite($1)`, [code])).toBe(false)
    expect(await call(invitee, `public.claim_invite($1)`, [code])).toBe(true)
    expect(await call(invitee, `public.claim_invite($1)`, [code])).toBe(false)
    expect(await call(inviter, `public.my_invite()`)).toMatchObject({ joined: 1, posted: 0 })
    await newThread(invitee)
    await newThread(invitee)
    expect(await call(inviter, `public.my_invite()`)).toMatchObject({ joined: 1, posted: 1 })
    await db.as(null)
    const { n } = await db.one<{ n: number }>(`SELECT count(*)::int n FROM public.points_log WHERE user_id = $1 AND reason = 'invite_first_post'`, [inviter])
    expect(n).toBe(1)
  })

  it('refuses old accounts', async () => {
    const inviter = await db.addUser({ dating: false })
    const old = await db.addUser({ dating: false })
    const { code } = await call(inviter, `public.my_invite()`)
    await db.as(null)
    await db.query(`UPDATE public.profiles SET created_at = now() - interval '30 days' WHERE id = $1`, [old])
    expect(await call(old, `public.claim_invite($1)`, [code])).toBe(false)
  })
})

describe('trusted members', () => {
  it('only admins can mark them, and the table stays closed', async () => {
    const admin = await db.addUser({ dating: false, admin: true })
    const member = await db.addUser({ dating: false })
    await expect(call(member, `public.admin_set_trusted($1, true)`, [member])).rejects.toThrow(/Admins only/)
    await call(admin, `public.admin_set_trusted($1, true)`, [member])
    const { rows } = await asMember(member, () => db.query<{ trusted: boolean; level: number }>(`SELECT * FROM public.member_labels($1)`, [[member]]))
    expect(rows[0]).toMatchObject({ trusted: true, level: 1 })
    await expect(asMember(member, () => db.query(`SELECT * FROM public.trusted_members`))).rejects.toThrow(/permission/)
  })
})

describe('LGA of the month', () => {
  it('ranks LGAs by replies, best answers and new members', async () => {
    const aba = await db.addUser({ dating: false })
    const bende = await db.addUser({ dating: false })
    await db.as(null)
    await db.query(`UPDATE public.profiles SET lga = 'Aba North' WHERE id = $1`, [aba])
    await db.query(`UPDATE public.profiles SET lga = 'Bende' WHERE id = $1`, [bende])
    const t = await newThread(bende)
    const r = await addReply(t, aba)
    await call(bende, `public.set_best_answer($1, $2)`, [t, r])
    const { rows } = await asMember(aba, () => db.query<{ lga: string }>(`SELECT * FROM public.lga_of_the_month()`))
    expect(rows[0]).toMatchObject({ lga: 'Aba North' })
    expect(rows[0]).toMatchObject({ replies: 1, best_answers: 1, new_members: 1, score: 8 })
  })
})

describe('jobs and services board', () => {
  it('lists work reasons only, never dating profiles', async () => {
    const viewer = await db.addUser({ dating: false })
    const worker = await db.addUser()
    const dating = await db.addUser()
    await db.as(null)
    await db.query(`UPDATE public.relationship_profiles SET looking_for = 'hiring' WHERE user_id = $1`, [worker])
    await db.query(`UPDATE public.relationship_profiles SET looking_for = 'marriage' WHERE user_id = $1`, [dating])
    const { rows } = await asMember(viewer, () => db.query<{ user_id: string }>(`SELECT * FROM public.opportunities_board('hiring')`))
    const ids = rows.map((x) => x.user_id)
    expect(ids).toContain(worker)
    expect(ids).not.toContain(dating)
  })

  it('keeps one link between discussions and replies, so reply counts can load', async () => {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE contype = 'f' AND conrelid = 'public.threads'::regclass AND confrelid = 'public.replies'::regclass`,
    )
    expect(rows[0].n).toBe(0)
  })
})
