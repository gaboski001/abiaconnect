// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createForumDb, type ForumDb } from './forumHarness'

// Each test builds a fresh Postgres; give it room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

describe('security review fixes', () => {
  let db: ForumDb
  let owner: string
  let member: string
  let snoop: string
  let privateGroup: string
  beforeEach(async () => {
    db = await createForumDb()
    owner = await db.addUser()
    member = await db.addUser()
    snoop = await db.addUser()
    privateGroup = (
      await db.one<{ id: string }>(`INSERT INTO subgroups (name, created_by, is_private) VALUES ('Private', $1, true) RETURNING id`, [owner])
    ).id
    await db.query(`INSERT INTO subgroup_members (subgroup_id, user_id) VALUES ($1, $2), ($1, $3)`, [privateGroup, owner, member])
  })

  const isMember = (asUser: string, group: string, who: string) =>
    db.asMember(asUser, () => db.one<{ v: boolean }>(`SELECT is_subgroup_member($1, $2) AS v`, [group, who])).then((r) => r.v)

  describe('private group membership', () => {
    it('members can still check their own membership (security rules rely on this)', async () => {
      expect(await isMember(member, privateGroup, member)).toBe(true)
      expect(await isMember(snoop, privateGroup, snoop)).toBe(false)
    })

    it('outsiders can no longer find out who is in a private group', async () => {
      expect(await isMember(snoop, privateGroup, member)).toBe(false)
    })

    it('the group owner and site admins still can', async () => {
      const admin = await db.addUser({ admin: true })
      expect(await isMember(owner, privateGroup, member)).toBe(true)
      expect(await isMember(admin, privateGroup, member)).toBe(true)
    })

    it('server jobs (no signed-in user) are unaffected', async () => {
      await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`)
      const r = await db.one<{ v: boolean }>(`SELECT is_subgroup_member($1, $2) AS v`, [privateGroup, member])
      expect(r.v).toBe(true)
    })

    it('the contest visibility check only answers about yourself', async () => {
      const cid = (
        await db.one<{ id: string }>(
          `INSERT INTO contests (title, subgroup_id, created_by, status, allow_group_voters, starts_at, ends_at)
           VALUES ('Private vote', $1, $2, 'approved', true, now(), now() + interval '1 day') RETURNING id`,
          [privateGroup, owner],
        )
      ).id
      const ask = (as: string, who: string) =>
        db.asMember(as, () => db.one<{ v: boolean }>(`SELECT can_view_contest($1, $2) AS v`, [cid, who])).then((r) => r.v)
      expect(await ask(member, member)).toBe(true)
      expect(await ask(snoop, member)).toBe(false)
    })
  })

  describe('thread view counts', () => {
    it('counts views, ignores removed posts and caps each person per minute', async () => {
      const t = (await db.one<{ id: string }>(`INSERT INTO threads (author_id) VALUES ($1) RETURNING id`, [owner])).id
      const gone = (await db.one<{ id: string }>(`INSERT INTO threads (author_id, is_deleted) VALUES ($1, true) RETURNING id`, [owner])).id
      for (let i = 0; i < 65; i++) await db.asMember(snoop, () => db.query(`SELECT increment_thread_view($1)`, [t]))
      await db.asMember(member, () => db.query(`SELECT increment_thread_view($1)`, [gone]))
      const views = async (id: string) => (await db.one<{ v: number }>(`SELECT view_count AS v FROM threads WHERE id = $1`, [id])).v
      expect(await views(t)).toBe(60)
      expect(await views(gone)).toBe(0)
    })
  })

  describe('public profiles', () => {
    it('hides deleted accounts’ details from members but not from admins', async () => {
      await db.query(
        `UPDATE profiles SET display_name = 'Real Name', avatar_url = 'a.png', bio = 'bio', lga = 'Bende', is_deleted = true WHERE id = $1`,
        [member],
      )
      const seen = await db.asMember(snoop, () =>
        db.one<Record<string, unknown>>(`SELECT display_name, avatar_url, bio, lga, is_deleted FROM get_public_profiles(ARRAY[$1]::uuid[])`, [member]),
      )
      expect(seen).toEqual({ display_name: 'Deleted member', avatar_url: null, bio: null, lga: null, is_deleted: true })
      const admin = await db.addUser({ admin: true })
      const adminView = await db.asMember(admin, () =>
        db.one<{ display_name: string }>(`SELECT display_name FROM get_public_profiles(ARRAY[$1]::uuid[])`, [member]),
      )
      expect(adminView.display_name).toBe('Real Name')
      // Active members look exactly as before.
      const active = await db.asMember(snoop, () =>
        db.one<{ display_name: string }>(`SELECT display_name FROM get_public_profiles(ARRAY[$1]::uuid[])`, [owner]),
      )
      expect(active.display_name).toBe('User')
    })
  })
})
