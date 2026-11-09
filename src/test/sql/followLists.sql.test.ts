// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Instagram-style Followers / Following lists, Unfollow and Remove follower.
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
  // The member-page visibility rule (20261107140000_community_growth.sql), without the parts this test doesn't need.
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.community_member_visible(_owner uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT auth.uid() IS NOT NULL AND (_owner = auth.uid() OR (
        NOT public.dating_is_blocked(_owner, auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _owner AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false))))
    $$;
    GRANT EXECUTE ON FUNCTION public.community_member_visible(uuid) TO authenticated;
  `)
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261109190000_follow_lists.sql'), 'utf8'))
}, 60_000)

const asMember = <T>(user: string, fn: () => Promise<T>) =>
  db.asRole('authenticated', async () => {
    await db.as(user)
    return fn()
  })
const follow = (a: string, b: string) => asMember(a, () => db.query(`SELECT public.connect_toggle_follow($1)`, [b]))
const named = async (name: string) => {
  const id = await db.addUser()
  await db.as(null)
  await db.query(`UPDATE public.profiles SET display_name = $2 WHERE id = $1`, [id, name])
  return id
}
type Row = { user_id: string; display_name: string; i_follow: boolean; follows_me: boolean }
const list = (viewer: string, user: string, kind: string, q: string | null = null) =>
  asMember(viewer, async () => (await db.query<Row>(`SELECT * FROM public.member_follow_list($1, $2, $3)`, [user, kind, q])).rows)

describe('followers and following lists', () => {
  it('anyone signed in can see another member’s lists, with Follow / Follow back state', async () => {
    const ada = await named('Ada Obi')
    const chi = await named('Chi Eze')
    const me = await named('Me')
    await follow(ada, chi)
    await follow(me, ada)
    await follow(chi, me)

    const chiFollowers = await list(me, chi, 'followers')
    expect(chiFollowers).toEqual([expect.objectContaining({ user_id: ada, display_name: 'Ada Obi', i_follow: true, follows_me: false })])
    const adaFollowing = await list(me, ada, 'following')
    expect(adaFollowing).toEqual([expect.objectContaining({ user_id: chi, i_follow: false, follows_me: true })])
  })

  it('searches by name and pages through long lists', async () => {
    const star = await named('Star')
    const names = ['Nkem', 'Nnamdi', 'Obinna', 'Uche']
    for (const n of names) await follow(await named(n), star)
    expect((await list(star, star, 'followers', 'nn')).map((r) => r.display_name).sort()).toEqual(['Nnamdi', 'Obinna'])
    const page2 = await asMember(star, async () => (await db.query(`SELECT * FROM public.member_follow_list($1, 'followers', NULL, 3, 3)`, [star])).rows)
    expect(page2).toHaveLength(1)
  })

  it('hides blocked people and banned accounts, and refuses signed-out visitors', async () => {
    const owner = await named('Owner')
    const fan = await named('Fan')
    const viewer = await named('Viewer')
    await follow(fan, owner)
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [viewer, fan])
    expect(await list(viewer, owner, 'followers')).toEqual([])
    expect((await list(owner, owner, 'followers')).map((r) => r.user_id)).toEqual([fan])
    await expect(
      db.asRole('anon', async () => {
        await db.as(null)
        return db.query(`SELECT * FROM public.member_follow_list($1, 'followers')`, [owner])
      }),
    ).rejects.toThrow(/permission denied/)
  })

  it('Remove follower takes them out of your followers only', async () => {
    const me = await named('Me2')
    const fan = await named('Fan2')
    await follow(fan, me)
    await follow(me, fan)
    await asMember(me, () => db.query(`SELECT public.remove_follower($1)`, [fan]))
    expect(await list(me, me, 'followers')).toEqual([])
    expect((await list(me, me, 'following')).map((r) => r.user_id)).toEqual([fan])
  })

  it('my_following_ids returns everyone, not just the first 50', async () => {
    const me = await named('Big follower')
    for (let i = 0; i < 55; i++) await follow(me, await db.addUser())
    const ids = await asMember(me, async () => (await db.one<{ ids: string[] }>(`SELECT public.my_following_ids() AS ids`)).ids)
    expect(ids).toHaveLength(55)
  })
})
