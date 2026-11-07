// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Followers, photo likes, name search and public posts on the real migration,
// through the same role members use.
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(`
    ALTER TABLE public.relationship_profiles ADD COLUMN looking_for text;
    CREATE TABLE public.categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
    CREATE TABLE public.subgroups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, is_private boolean NOT NULL DEFAULT false);
    CREATE TABLE public.threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, user_id uuid, category_id uuid, subgroup_id uuid,
      is_deleted boolean NOT NULL DEFAULT false, is_anonymous boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION public.is_public_subgroup(_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT EXISTS (SELECT 1 FROM public.subgroups s WHERE s.id = _id AND NOT s.is_private) $$;
  `)
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261107120000_connect_professional.sql'), 'utf8'))
}, 60_000)

const asMember = <T>(user: string, fn: () => Promise<T>) =>
  db.asRole('authenticated', async () => {
    await db.as(user)
    return fn()
  })

const follow = (a: string, b: string) =>
  asMember(a, async () => (await db.one<{ r: Record<string, unknown> }>(`SELECT public.connect_toggle_follow($1) r`, [b])).r)

const named = async (name: string) => {
  const id = await db.addUser()
  await db.as(null)
  await db.query(`UPDATE public.profiles SET display_name = $2 WHERE id = $1`, [id, name])
  return id
}

describe('why a member is here', () => {
  it('accepts work reasons and refuses made-up ones', async () => {
    const a = await db.addUser()
    await db.as(null)
    await db.query(`UPDATE public.relationship_profiles SET looking_for = 'work', work_experience = '5 years' WHERE user_id = $1`, [a])
    await expect(db.query(`UPDATE public.relationship_profiles SET looking_for = 'nonsense' WHERE user_id = $1`, [a])).rejects.toThrow(/check/)
  })
})

describe('followers', () => {
  it('follows, counts, alerts once a day, and unfollows', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    expect(await follow(a, b)).toMatchObject({ status: 'ok', following: true, followers: 1 })
    expect(await follow(a, b)).toMatchObject({ status: 'ok', following: false, followers: 0 })
    await follow(a, b)
    await db.as(null)
    const alerts = await db.query(`SELECT 1 FROM public.notifications WHERE user_id = $1 AND type = 'connect_follow'`, [b])
    expect(alerts.rows).toHaveLength(1)
  })

  it('shows the names to the owner only', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    await follow(a, b)
    const mine = await asMember(b, () => db.query(`SELECT user_id FROM public.connect_my_people('followers')`))
    expect(mine.rows).toEqual([{ user_id: a }])
    const theirs = await asMember(a, () => db.query(`SELECT user_id FROM public.connect_my_people('followers')`))
    expect(theirs.rows).toEqual([])
    await expect(asMember(a, () => db.query(`SELECT * FROM public.connect_follows`))).rejects.toThrow(/permission/)
  })

  it('refuses yourself, blocked members, private mode, and banned accounts', async () => {
    const a = await db.addUser()
    expect(await follow(a, a)).toMatchObject({ status: 'unavailable' })

    const blocked = await db.addUser()
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [blocked, a])
    expect(await follow(a, blocked)).toMatchObject({ status: 'unavailable' })

    const hidden = await db.addUser()
    await db.as(null)
    await db.query(`UPDATE public.relationship_profiles SET incognito = true WHERE user_id = $1`, [hidden])
    expect(await follow(a, hidden)).toMatchObject({ status: 'unavailable' })

    const banned = await db.addUser({ banned: true })
    expect(await follow(banned, a)).toMatchObject({ status: 'account_restricted' })
  })

  it('ends follows both ways when someone is blocked', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    await follow(a, b)
    await follow(b, a)
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [a, b])
    const left = await db.query(`SELECT 1 FROM public.connect_follows WHERE follower_id IN ($1, $2)`, [a, b])
    expect(left.rows).toHaveLength(0)
  })
})

describe('photo likes', () => {
  it('likes only photos on the profile, and the owner sees who liked', async () => {
    const owner = await db.addUser()
    const fan = await db.addUser()
    const photo = 'https://example.com/a.webp'
    await db.as(null)
    await db.query(`UPDATE public.relationship_profiles SET photos = ARRAY[$2] WHERE user_id = $1`, [owner, photo])
    const like = (url: string) =>
      asMember(fan, async () => (await db.one<{ r: Record<string, unknown> }>(`SELECT public.connect_toggle_photo_like($1, $2) r`, [owner, url])).r)

    expect(await like('https://example.com/other.webp')).toMatchObject({ status: 'unavailable' })
    expect(await like(photo)).toMatchObject({ status: 'ok', liked: true, likes: 1 })

    const people = await asMember(owner, () => db.query(`SELECT user_id, photo_url FROM public.connect_my_people('photo_likes')`))
    expect(people.rows).toEqual([{ user_id: fan, photo_url: photo }])

    const summary = await asMember(fan, async () => (await db.one<{ s: { photo_likes: Record<string, unknown> } }>(`SELECT public.connect_profile_summary($1) s`, [owner])).s)
    expect(summary.photo_likes[photo]).toEqual({ likes: 1, liked: true })
  })
})

describe('search by name', () => {
  it('finds members by part of a name, treating % as an ordinary letter', async () => {
    const me = await db.addUser()
    const ada = await named('Adaeze Okafor')
    const search = (q: string) =>
      asMember(me, async () => (await db.query<{ user_id: string }>(`SELECT user_id FROM public.connect_search($1)`, [q])).rows.map((r) => r.user_id))

    expect(await search('adaez')).toContain(ada)
    expect(await search('%')).toEqual([])
    expect(await search('%%%')).not.toContain(ada)
  })

  it('hides blocked members and members in private mode', async () => {
    const me = await db.addUser()
    const blocked = await named('Zikoranaudo Blocked')
    const hidden = await named('Zikoranaudo Hidden')
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [blocked, me])
    await db.query(`UPDATE public.relationship_profiles SET incognito = true WHERE user_id = $1`, [hidden])
    const found = await asMember(me, () => db.query(`SELECT user_id FROM public.connect_search('Zikoranaudo')`))
    expect(found.rows).toEqual([])
  })
})

describe('public posts on a profile', () => {
  it('lists forum and public-group posts, never anonymous, deleted or private-group ones', async () => {
    const author = await db.addUser()
    const reader = await db.addUser()
    await db.as(null)
    const open = await db.one<{ id: string }>(`INSERT INTO public.subgroups (name) VALUES ('Aba') RETURNING id`)
    const closed = await db.one<{ id: string }>(`INSERT INTO public.subgroups (name, is_private) VALUES ('Secret', true) RETURNING id`)
    await db.query(
      `INSERT INTO public.threads (title, user_id, subgroup_id, is_anonymous, is_deleted) VALUES
        ('forum', $1, NULL, false, false), ('group', $1, $2, false, false), ('secret', $1, $3, false, false),
        ('anon', $1, NULL, true, false), ('gone', $1, NULL, false, true)`,
      [author, open.id, closed.id],
    )
    const posts = await asMember(reader, () => db.query<{ title: string }>(`SELECT title FROM public.connect_member_posts($1)`, [author]))
    expect(posts.rows.map((p) => p.title).sort()).toEqual(['forum', 'group'])
  })
})
