// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// The volunteer migration plus the live tables this one reads and writes.
const EXTRAS = `
  CREATE TABLE public.user_roles (user_id uuid NOT NULL, role text NOT NULL);
  ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE public.profiles ADD COLUMN lga text, ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  CREATE TABLE public.subgroups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, kind text NOT NULL DEFAULT 'interest', lga text
  );
  CREATE TABLE public.subgroup_members (subgroup_id uuid NOT NULL, user_id uuid NOT NULL, UNIQUE (subgroup_id, user_id));
  CREATE TABLE public.group_champions (
    subgroup_id uuid NOT NULL, user_id uuid NOT NULL, added_by uuid, PRIMARY KEY (subgroup_id, user_id)
  );
  CREATE TABLE public.threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL DEFAULT 'A discussion', content text,
    user_id uuid, private_author_id uuid, is_anonymous boolean NOT NULL DEFAULT false,
    is_deleted boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, user_id uuid,
    content text NOT NULL DEFAULT '<p>A reply</p>', is_hidden boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, reply_id uuid, reporter_id uuid,
    reported_user_id uuid, reason text, status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now()
  );
`

let db: Db
let admin: string

const migration = (file: string) => readFileSync(resolve(__dirname, '../../../supabase/migrations', file), 'utf8')

const user = async (email?: string) => {
  const id = await db.addUser({ dating: false })
  if (email) await db.query(`UPDATE auth.users SET email = $2 WHERE id = $1`, [id, email])
  return id
}

const apply = async (role: string, email: string, opts: { user?: string | null; lga?: string } = {}) =>
  (
    await db.one<{ id: string }>(
      `SELECT public.volunteer_submit('Ada Nwosu', $1, '+234 801 234 5678', 'Umuahia', $2, $3, '3 to 5 hours a week',
        'I have helped run our town union group for four years and enjoy it.',
        'I have helped run our town union group for four years and enjoy it.', NULL, '[]'::jsonb, $4) AS id`,
      [email, opts.lga ?? 'Bende', role, opts.user ?? null],
    )
  ).id

const decide = (id: string, decision = 'approve') =>
  db.one<{ status: string; powers_granted_at: string | null; user_id: string | null }>(
    `SELECT * FROM public.volunteer_decide($1, $2, $3, NULL)`,
    [id, decision, admin],
  )

const powers = async (uid: string) => {
  await db.as(uid)
  try {
    return (await db.one<{ p: { role: string | null; moderate: boolean; review: boolean } }>(`SELECT public.my_volunteer_powers() AS p`)).p
  } finally {
    await db.as(null)
  }
}

const lastNote = async (uid: string) =>
  (await db.one<{ message: string; link: string }>(
    `SELECT message, link FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC, message LIMIT 1`,
    [uid],
  )) ?? null

const asUser = async <T>(uid: string, fn: () => Promise<T>) => {
  await db.as(uid)
  try {
    return await fn()
  } finally {
    await db.as(null)
  }
}

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(EXTRAS)
  await db.exec(migration('20261013090000_volunteer_applications.sql'))
  await db.exec(migration('20261109090000_volunteer_team_and_community_pages.sql'))
  admin = await db.addUser({ admin: true, dating: false })
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.volunteer_team; DELETE FROM public.volunteer_applications; DELETE FROM public.notifications;
    DELETE FROM public.reports; DELETE FROM public.moderator_actions; DELETE FROM public.success_stories;
    DELETE FROM public.community_events; DELETE FROM public.spotlight_nominations; DELETE FROM public.member_spotlights;
  `)
})

describe('approving a volunteer', () => {
  it('switches moderator tools on at once and tells them where to find them', async () => {
    const ada = await user('ada@example.com')
    const app = await apply('moderator', 'ada@example.com', { user: ada })
    expect(await powers(ada)).toEqual({ role: null, moderate: false, review: false })

    const row = await decide(app)
    expect(row.powers_granted_at).not.toBeNull()
    expect(await powers(ada)).toEqual({ role: 'moderator', moderate: true, review: true })
    expect(await lastNote(ada)).toMatchObject({ link: '/moderate', message: expect.stringContaining('Community Moderator') })
  })

  it('finds their account by email when they applied without signing in', async () => {
    const ada = await user('Chi@Example.com')
    const app = await apply('writer', 'chi@example.com')
    await decide(app)
    expect(await powers(ada)).toEqual({ role: 'writer', moderate: false, review: true })
  })

  it('waits for the sign-up when there is no account yet, then switches on at first sign-in', async () => {
    const app = await apply('moderator', 'new@example.com')
    expect((await decide(app)).powers_granted_at).toBeNull()

    const fresh = await user('new@example.com')
    const role = await asUser(fresh, async () => (await db.one<{ r: string }>(`SELECT public.claim_volunteer_powers() AS r`)).r)
    expect(role).toBe('moderator')
    expect(await powers(fresh)).toMatchObject({ moderate: true })
    // Only once.
    expect(await asUser(fresh, async () => (await db.one<{ r: string | null }>(`SELECT public.claim_volunteer_powers() AS r`)).r)).toBeNull()
  })

  it('makes a connector the champion of their LGA group', async () => {
    const { id: bende } = await db.one<{ id: string }>(`INSERT INTO public.subgroups (name, kind, lga) VALUES ('Bende LGA', 'lga', 'Bende') RETURNING id`)
    const obi = await user('obi@example.com')
    await decide(await apply('connector', 'obi@example.com', { user: obi, lga: 'Bende' }))
    expect((await db.query(`SELECT 1 FROM public.group_champions WHERE subgroup_id = $1 AND user_id = $2`, [bende, obi])).rows).toHaveLength(1)
    expect((await db.query(`SELECT 1 FROM public.subgroup_members WHERE subgroup_id = $1 AND user_id = $2`, [bende, obi])).rows).toHaveLength(1)
    expect(await powers(obi)).toEqual({ role: 'connector', moderate: false, review: false })
    expect((await lastNote(obi)).link).toBe(`/subgroups/${bende}`)
  })

  it('gives nothing on decline, and an admin can end a role', async () => {
    const ada = await user('ada@example.com')
    await decide(await apply('moderator', 'ada@example.com', { user: ada }), 'decline')
    expect(await powers(ada)).toMatchObject({ moderate: false })

    await asUser(admin, () => db.query(`SELECT public.admin_set_volunteer_role($1, 'moderator')`, [ada]))
    expect(await powers(ada)).toMatchObject({ role: 'moderator', moderate: true })
    await asUser(admin, () => db.query(`SELECT public.admin_set_volunteer_role($1, NULL)`, [ada]))
    expect(await powers(ada)).toMatchObject({ role: null, moderate: false })
    expect((await lastNote(ada)).message).toContain('has ended')
  })

  it('lets only admins manage the team', async () => {
    const ada = await user()
    await expect(asUser(ada, () => db.query(`SELECT public.admin_set_volunteer_role($1, 'moderator')`, [ada]))).rejects.toThrow(/not_admin/)
    await expect(asUser(ada, () => db.query(`SELECT * FROM public.admin_volunteer_team()`))).rejects.toThrow(/not_admin/)
  })
})

describe('moderating reported posts', () => {
  const setup = async () => {
    const mod = await user()
    await db.query(`INSERT INTO public.volunteer_team (user_id, role) VALUES ($1, 'moderator')`, [mod])
    const author = await user()
    const { id: thread } = await db.one<{ id: string }>(
      `INSERT INTO public.threads (title, content, user_id) VALUES ('Rude title', '<p>Rude words</p>', $1) RETURNING id`,
      [author],
    )
    const { id: report } = await db.one<{ id: string }>(`INSERT INTO public.reports (thread_id, reason) VALUES ($1, 'Insults') RETURNING id`, [thread])
    await db.query(`INSERT INTO public.reports (thread_id, reason) VALUES ($1, 'Spam')`, [thread])
    return { mod, author, thread, report }
  }

  it('shows the queue, hides the post, closes every report on it and tells the author', async () => {
    const { mod, author, thread, report } = await setup()
    const queue = await asUser(mod, async () => (await db.query<{ excerpt: string; reports_on_post: number }>(`SELECT * FROM public.mod_queue()`)).rows)
    expect(queue).toHaveLength(2)
    expect(queue[0]).toMatchObject({ excerpt: 'Rude words', reports_on_post: 2 })

    await asUser(mod, () => db.query(`SELECT public.mod_decide($1, 'hide')`, [report]))
    expect((await db.one<{ is_deleted: boolean }>(`SELECT is_deleted FROM public.threads WHERE id = $1`, [thread])).is_deleted).toBe(true)
    expect((await db.query(`SELECT 1 FROM public.reports WHERE status = 'pending'`)).rows).toHaveLength(0)
    expect((await lastNote(author)).message).toContain('hidden by a community moderator')
  })

  it('can be undone by the same moderator, and the author is told', async () => {
    const { mod, author, thread, report } = await setup()
    const { id } = await asUser(mod, () => db.one<{ id: string }>(`SELECT public.mod_decide($1, 'hide') AS id`, [report]))
    await asUser(mod, () => db.query(`SELECT public.mod_undo($1)`, [id]))
    expect((await db.one<{ is_deleted: boolean }>(`SELECT is_deleted FROM public.threads WHERE id = $1`, [thread])).is_deleted).toBe(false)
    expect((await lastNote(author)).message).toContain('visible again')
    await expect(asUser(mod, () => db.query(`SELECT public.mod_undo($1)`, [id]))).rejects.toThrow(/already_undone/)
  })

  it('keeps a post and dismisses its reports', async () => {
    const { mod, thread, report } = await setup()
    await asUser(mod, () => db.query(`SELECT public.mod_decide($1, 'keep')`, [report]))
    expect((await db.one<{ is_deleted: boolean }>(`SELECT is_deleted FROM public.threads WHERE id = $1`, [thread])).is_deleted).toBe(false)
    expect((await db.query(`SELECT 1 FROM public.reports WHERE status = 'dismissed'`)).rows).toHaveLength(2)
  })

  it('hides replies too', async () => {
    const { mod } = await setup()
    const writer = await user()
    const { id: reply } = await db.one<{ id: string }>(
      `INSERT INTO public.replies (thread_id, user_id) VALUES (gen_random_uuid(), $1) RETURNING id`,
      [writer],
    )
    const { id: report } = await db.one<{ id: string }>(`INSERT INTO public.reports (reply_id) VALUES ($1) RETURNING id`, [reply])
    await asUser(mod, () => db.query(`SELECT public.mod_decide($1, 'hide')`, [report]))
    expect((await db.one<{ is_hidden: boolean }>(`SELECT is_hidden FROM public.replies WHERE id = $1`, [reply])).is_hidden).toBe(true)
  })

  it('keeps members out, and moderators away from reports on their own posts', async () => {
    const { mod, report } = await setup()
    const member = await user()
    await expect(asUser(member, () => db.query(`SELECT * FROM public.mod_queue()`))).rejects.toThrow(/not_allowed/)
    await expect(asUser(member, () => db.query(`SELECT public.mod_decide($1, 'hide')`, [report]))).rejects.toThrow(/not_allowed/)

    const { id: own } = await db.one<{ id: string }>(`INSERT INTO public.threads (user_id) VALUES ($1) RETURNING id`, [mod])
    const { id: ownReport } = await db.one<{ id: string }>(`INSERT INTO public.reports (thread_id) VALUES ($1) RETURNING id`, [own])
    const queue = await asUser(mod, async () => (await db.query<{ report_id: string }>(`SELECT * FROM public.mod_queue()`)).rows)
    expect(queue.map((q) => q.report_id)).not.toContain(ownReport)
    await expect(asUser(mod, () => db.query(`SELECT public.mod_decide($1, 'hide')`, [ownReport]))).rejects.toThrow(/own_post/)
  })
})

describe('community pages', () => {
  const story = (uid: string, title = 'Aba shoemaker now exports to Ghana') =>
    asUser(uid, () =>
      db.one<{ id: string }>(`SELECT public.submit_success_story($1, $2, 'Business', 'Chinedu') AS id`, [title, 'x'.repeat(120)]),
    )

  it('shows a story only after the team publishes it, and tells the member', async () => {
    const member = await user()
    const reviewer = await user()
    await db.query(`INSERT INTO public.volunteer_team (user_id, role) VALUES ($1, 'writer')`, [reviewer])
    const { id } = await story(member)
    expect((await db.query(`SELECT * FROM public.list_success_stories()`)).rows).toHaveLength(0)

    await asUser(reviewer, () => db.query(`SELECT public.review_community_item('story', $1, 'publish')`, [id]))
    expect((await db.query(`SELECT * FROM public.list_success_stories()`)).rows).toHaveLength(1)
    expect((await lastNote(member)).message).toContain('is now live')
  })

  it('refuses visitors, members reviewing, and too many waiting stories', async () => {
    const member = await user()
    await expect(db.query(`SELECT public.submit_success_story('A long enough title', $1, 'Business')`, ['x'.repeat(120)])).rejects.toThrow(/sign_in/)
    const { id } = await story(member)
    await expect(asUser(member, () => db.query(`SELECT public.review_community_item('story', $1, 'publish')`, [id]))).rejects.toThrow(/not_allowed/)
    await story(member)
    await story(member)
    await expect(story(member)).rejects.toThrow(/too_many_waiting/)
  })

  it('lists upcoming published events only, and checks dates and links', async () => {
    const member = await user()
    const submit = (starts: string, link: string | null = 'https://meet.example.com/x') =>
      asUser(member, () =>
        db.one<{ id: string }>(
          `SELECT public.submit_community_event('Umuahia town hall', 'A friendly evening for everyone from Umuahia.', $1::timestamptz, NULL, NULL, $2, 'Umuahia North') AS id`,
          [starts, link],
        ),
      )
    await expect(submit('2020-01-01')).rejects.toThrow(/date_invalid/)
    await expect(submit(new Date(Date.now() + 86_400_000).toISOString(), 'http://insecure.example.com')).rejects.toThrow(/link_invalid/)
    await expect(submit(new Date(Date.now() + 86_400_000).toISOString(), null)).rejects.toThrow(/place_missing/)
    const { id } = await submit(new Date(Date.now() + 86_400_000).toISOString())
    await asUser(admin, () => db.query(`SELECT public.review_community_item('event', $1, 'publish')`, [id]))
    expect((await db.query(`SELECT * FROM public.list_upcoming_events()`)).rows).toHaveLength(1)
  })

  it('takes nominations by username and makes a Member of the Month', async () => {
    const member = await user()
    const star = await user()
    await db.query(`UPDATE public.profiles SET username = 'ikenna' WHERE id = $1`, [star])
    await expect(asUser(member, () => db.query(`SELECT public.submit_spotlight_nomination('@nobody', $1)`, ['r'.repeat(40)]))).rejects.toThrow(/member_not_found/)
    await expect(asUser(star, () => db.query(`SELECT public.submit_spotlight_nomination('ikenna', $1)`, ['r'.repeat(40)]))).rejects.toThrow(/not_yourself/)
    const { id } = await asUser(member, () =>
      db.one<{ id: string }>(`SELECT public.submit_spotlight_nomination('@Ikenna', $1) AS id`, ['Always answers questions for newcomers.']),
    )
    await asUser(admin, () =>
      db.query(`SELECT public.publish_member_spotlight($1, 'Always there for newcomers', $2, NULL, $3)`, [star, 'a'.repeat(60), id]),
    )
    const spots = (await db.query<{ member_id: string }>(`SELECT * FROM public.list_member_spotlights()`)).rows
    expect(spots.map((s) => s.member_id)).toEqual([star])
    expect((await db.one<{ status: string }>(`SELECT status FROM public.spotlight_nominations WHERE id = $1`, [id])).status).toBe('featured')
    expect((await lastNote(star)).message).toContain('Member of the Month')
  })
})
