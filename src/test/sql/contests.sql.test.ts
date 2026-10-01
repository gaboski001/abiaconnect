// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createForumDb, type ForumDb } from './forumHarness'

// Each test builds a fresh Postgres; give it room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

type Contest = Record<string, unknown> & {
  candidates: Array<{ id: string; name: string }>
  results: Array<{ candidate_id: string; votes: number }> | null
}

const CANDIDATES = JSON.stringify([{ name: 'Ada' }, { name: 'Chidi' }, { name: 'Ngozi' }])

describe('contests', () => {
  let db: ForumDb
  let admin: string
  let owner: string
  let member: string
  let outsider: string
  let group: string

  beforeEach(async () => {
    db = await createForumDb()
    admin = await db.addUser({ admin: true })
    owner = await db.addUser()
    member = await db.addUser()
    outsider = await db.addUser()
    group = (await db.one<{ id: string }>(`INSERT INTO subgroups (name, created_by) VALUES ('Aba Traders', $1) RETURNING id`, [owner])).id
    await db.query(`INSERT INTO subgroup_members (subgroup_id, user_id) VALUES ($1, $2), ($1, $3)`, [group, owner, member])
  })

  const create = (uid: string, opts: { subgroup?: string | null; group?: boolean; codes?: boolean; visibility?: string; startsIn?: string } = {}) =>
    db
      .asMember(uid, () =>
        db.one<{ id: string }>(
          `SELECT create_contest('Chairman 2026', 'Annual election', $1, $2, $3, $4,
             now() + $5::interval, now() + interval '2 days', $6::jsonb) AS id`,
          [
            opts.subgroup === undefined ? group : opts.subgroup,
            opts.group ?? true,
            opts.codes ?? false,
            opts.visibility ?? 'after_close',
            opts.startsIn ?? '-1 minute',
            CANDIDATES,
          ],
        ),
      )
      .then((r) => r.id)

  const view = (uid: string, id: string) =>
    db.asMember(uid, () => db.one<{ c: Contest }>(`SELECT get_contest($1) AS c`, [id])).then((r) => r.c)

  const vote = (uid: string, id: string, candidate: string, code: string | null = null) =>
    db.asMember(uid, () => db.query(`SELECT cast_contest_vote($1, $2, $3)`, [id, candidate, code]))

  const approve = (id: string) => db.asMember(admin, () => db.query(`SELECT review_contest($1, true)`, [id]))

  describe('who can run a contest', () => {
    it('admins publish directly', async () => {
      const id = await create(admin, { subgroup: null, group: false, codes: true })
      expect((await view(admin, id)).status).toBe('approved')
    })

    it('a group owner’s contest waits for admin approval, and admins are told', async () => {
      const id = await create(owner)
      expect((await view(owner, id)).status).toBe('pending')
      const n = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'contest'`, [admin])
      expect(n.n).toBe(1)
    })

    it('ordinary members cannot create contests, even for a group they are in', async () => {
      expect(await db.error(() => create(member))).toMatch(/only_admins_or_group_owners/)
      expect(await db.error(() => create(member, { subgroup: null, group: false, codes: true }))).toMatch(/only_admins_or_group_owners/)
    })

    it('nobody can write contest tables directly', async () => {
      expect(
        await db.error(() =>
          db.asMember(admin, () =>
            db.query(`INSERT INTO contests (title, created_by, status, allow_code_voters, starts_at, ends_at)
                      VALUES ('x', $1, 'approved', true, now(), now() + interval '1 day')`, [admin]),
          ),
        ),
      ).toMatch(/permission denied/)
    })

    it('only admins approve, and approval notifies group members', async () => {
      const id = await create(owner)
      expect(await db.error(() => db.asMember(owner, () => db.query(`SELECT review_contest($1, true)`, [id])))).toMatch(/admins_only/)
      await approve(id)
      expect((await view(owner, id)).status).toBe('approved')
      const n = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'contest'`, [member])
      expect(n.n).toBe(1)
    })
  })

  describe('voting', () => {
    it('cannot vote on a contest that is still waiting for approval', async () => {
      const id = await create(owner)
      const c = await view(owner, id)
      expect(await db.error(() => vote(member, id, c.candidates[0].id))).toMatch(/not_found/)
      // …and other members can't even see it yet.
      expect(await db.error(() => view(member, id))).toMatch(/not_found/)
    })

    it('group members vote once; others cannot vote without a code', async () => {
      const id = await create(owner)
      await approve(id)
      const c = await view(member, id)
      await vote(member, id, c.candidates[1].id)
      expect(await db.error(() => vote(member, id, c.candidates[0].id))).toMatch(/already_voted/)
      expect(await db.error(() => vote(outsider, id, c.candidates[0].id))).toMatch(/not_eligible/)
      expect((await view(member, id)).has_voted).toBe(true)
    })

    it('respects the voting window', async () => {
      const id = await create(admin, { startsIn: '1 hour' })
      const c = await view(member, id)
      expect(c.phase).toBe('upcoming')
      expect(await db.error(() => vote(member, id, c.candidates[0].id))).toMatch(/not_started/)
      await db.query(`UPDATE contests SET starts_at = now() - interval '2 days', ends_at = now() - interval '1 minute' WHERE id = $1`, [id])
      expect(await db.error(() => vote(member, id, c.candidates[0].id))).toMatch(/voting_closed/)
    })

    it('rejects a candidate from another contest', async () => {
      const a = await create(admin)
      const b = await create(admin)
      const other = (await view(admin, b)).candidates[0].id
      expect(await db.error(() => vote(member, a, other))).toMatch(/invalid_candidate/)
    })
  })

  describe('one-time voter codes', () => {
    it('lets code holders vote once, and each code works only once', async () => {
      const id = await create(admin, { subgroup: null, group: false, codes: true })
      const codes = (await db.asMember(admin, () => db.query(`SELECT * FROM generate_contest_codes($1, 3) AS code`, [id]))).rows.map(
        (r) => (r as { code: string }).code,
      )
      expect(codes).toHaveLength(3)
      expect(new Set(codes).size).toBe(3)
      for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)

      const cand = (await view(outsider, id)).candidates[0].id
      expect(await db.error(() => vote(outsider, id, cand))).toMatch(/code_required/)
      expect(await db.error(() => vote(outsider, id, cand, 'AAAA-BBBB'))).toMatch(/invalid_code/)
      // Codes are case- and dash-insensitive for people typing them in.
      await vote(outsider, id, cand, codes[0].toLowerCase().replace('-', ' '))
      expect(await db.error(() => vote(member, id, cand, codes[0]))).toMatch(/invalid_code/)
      // One vote per account even with a second code.
      expect(await db.error(() => vote(outsider, id, cand, codes[1]))).toMatch(/already_voted/)
      expect((await view(admin, id)).codes).toEqual({ total: 3, used: 1 })
    })

    it('stores only hashes of codes', async () => {
      const id = await create(admin, { subgroup: null, group: false, codes: true })
      const [{ code }] = (await db.asMember(admin, () => db.query(`SELECT * FROM generate_contest_codes($1, 1) AS code`, [id]))).rows as Array<{ code: string }>
      const stored = await db.one<{ code_hash: string }>(`SELECT code_hash FROM contest_voter_codes WHERE contest_id = $1`, [id])
      expect(stored.code_hash).not.toContain(code.replace('-', ''))
      expect(stored.code_hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('only the organiser or an admin can generate codes', async () => {
      const id = await create(owner, { group: true, codes: true })
      await approve(id)
      expect(await db.error(() => db.asMember(member, () => db.query(`SELECT * FROM generate_contest_codes($1, 5)`, [id])))).toMatch(
        /not_allowed/,
      )
      const rows = (await db.asMember(owner, () => db.query(`SELECT * FROM generate_contest_codes($1, 5)`, [id]))).rows
      expect(rows).toHaveLength(5)
    })
  })

  describe('secret ballot and results', () => {
    it('hides results until voting closes when the organiser chose that', async () => {
      const id = await create(admin)
      const c = await view(member, id)
      await vote(member, id, c.candidates[2].id)
      const open = await view(member, id)
      expect(open.results).toBeNull()
      expect(Number(open.turnout)).toBe(1)
      await db.query(`UPDATE contests SET ends_at = now() - interval '1 second' WHERE id = $1`, [id])
      const closed = await view(member, id)
      expect(closed.phase).toBe('closed')
      expect(closed.results!.find((r) => r.candidate_id === c.candidates[2].id)!.votes).toBe(1)
    })

    it('shows live totals when the organiser chose that', async () => {
      const id = await create(admin, { visibility: 'live' })
      const c = await view(member, id)
      await vote(member, id, c.candidates[0].id)
      expect((await view(owner, id)).results!.find((r) => r.candidate_id === c.candidates[0].id)!.votes).toBe(1)
    })

    it('keeps ballots unlinkable to voters and unreadable to members', async () => {
      const cols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'contest_ballots'`)).rows.map(
        (r) => (r as { column_name: string }).column_name,
      )
      expect(cols.sort()).toEqual(['candidate_id', 'contest_id', 'id'])
      for (const table of ['contest_ballots', 'contest_voters', 'contest_voter_codes']) {
        expect(await db.error(() => db.asMember(admin, () => db.query(`SELECT * FROM ${table}`)))).toMatch(/permission denied/)
      }
    })

    it('gives voters points once per contest', async () => {
      const id = await create(admin)
      const c = await view(member, id)
      await vote(member, id, c.candidates[0].id)
      const p = await db.one<{ points: number }>(`SELECT points FROM member_stats WHERE user_id = $1`, [member])
      expect(p.points).toBe(5)
    })
  })

  it('organisers can cancel; cancelled contests take no votes', async () => {
    const id = await create(owner)
    await approve(id)
    expect(await db.error(() => db.asMember(member, () => db.query(`SELECT cancel_contest($1)`, [id])))).toMatch(/not_allowed/)
    await db.asMember(owner, () => db.query(`SELECT cancel_contest($1)`, [id]))
    const cand = (await view(owner, id)).candidates[0].id
    expect(await db.error(() => vote(member, id, cand))).toMatch(/not_found/)
  })
})
