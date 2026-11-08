// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createForumDb, type ForumDb } from './forumHarness'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

type Contest = Record<string, unknown> & {
  positions: Array<{ id: string; title: string; max_choices: number }>
  candidates: Array<{ id: string; name: string; position_id: string }>
  results: Array<{ candidate_id: string; votes: number }> | null
  group_block: string | null
  eligible_members: number | null
}

const EXEC = [
  { title: 'Chairman', max_choices: 1, candidates: [{ name: 'Ada' }, { name: 'Chidi' }] },
  { title: 'Secretary', max_choices: 1, candidates: [{ name: 'Emeka' }, { name: 'Ngozi' }] },
  { title: 'Committee', max_choices: 2, candidates: [{ name: 'Obi' }, { name: 'Uche' }, { name: 'Kelechi' }] },
]

describe('contest elections', () => {
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
    group = (await db.one<{ id: string }>(`INSERT INTO subgroups (name, created_by) VALUES ('Bende Union', $1) RETURNING id`, [owner])).id
    // Members joined a week ago; accounts are a month old.
    await db.query(`UPDATE profiles SET created_at = now() - interval '30 days'`)
    await db.query(
      `INSERT INTO subgroup_members (subgroup_id, user_id, created_at) VALUES ($1, $2, now() - interval '7 days'), ($1, $3, now() - interval '7 days')`,
      [group, owner, member],
    )
  })

  const create = (uid: string, extra: Record<string, unknown> = {}) =>
    db
      .asMember(uid, () =>
        db.one<{ id: string }>(`SELECT create_election($1::jsonb) AS id`, [
          JSON.stringify({
            title: 'Bende Union Executive 2026',
            subgroup_id: group,
            allow_group_voters: true,
            results_visibility: 'live',
            starts_at: new Date(Date.now() - 60_000).toISOString(),
            ends_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
            positions: EXEC,
            ...extra,
          }),
        ]),
      )
      .then((r) => r.id)

  const view = (uid: string | null, id: string) =>
    uid
      ? db.asMember(uid, () => db.one<{ c: Contest }>(`SELECT get_contest($1) AS c`, [id])).then((r) => r.c)
      : (async () => {
          await db.as(null)
          await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`)
          await db.query(`SET ROLE anon`)
          try {
            return (await db.one<{ c: Contest }>(`SELECT get_contest($1) AS c`, [id])).c
          } finally {
            await db.query(`RESET ROLE`)
            await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`)
          }
        })()

  const ballot = (uid: string, id: string, names: string[], c: Contest, code: string | null = null) =>
    db.asMember(uid, () =>
      db.query(`SELECT cast_contest_ballot($1, $2::jsonb, $3)`, [
        id,
        JSON.stringify(names.map((n) => c.candidates.find((k) => k.name === n)!.id)),
        code,
      ]),
    )

  it('one ballot covers several positions, and each position is counted on its own', async () => {
    const id = await create(admin)
    const c = await view(member, id)
    expect(c.positions.map((p) => p.title)).toEqual(['Chairman', 'Secretary', 'Committee'])
    await ballot(member, id, ['Ada', 'Ngozi', 'Obi', 'Uche'], c)
    await ballot(owner, id, ['Ada', 'Emeka', 'Obi'], c)
    const after = await view(member, id)
    const votes = (n: string) => after.results!.find((r) => r.candidate_id === c.candidates.find((k) => k.name === n)!.id)!.votes
    expect([votes('Ada'), votes('Chidi'), votes('Emeka'), votes('Ngozi'), votes('Obi'), votes('Uche'), votes('Kelechi')]).toEqual([2, 0, 1, 1, 2, 1, 0])
    expect(Number(after.turnout)).toBe(2)
    // A ballot never says who cast it.
    const cols = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'contest_ballots'`)
    expect(cols.rows.map((r) => r.column_name).sort()).toEqual(['candidate_id', 'contest_id', 'id'])
  })

  it('stops picking too many in a position, and empty or repeated choices', async () => {
    const id = await create(admin)
    const c = await view(member, id)
    expect(await db.error(() => ballot(member, id, ['Ada', 'Chidi'], c))).toMatch(/too_many_choices/)
    expect(await db.error(() => ballot(member, id, [], c))).toMatch(/choose_someone/)
    expect(
      await db.error(() =>
        db.asMember(member, () => db.query(`SELECT cast_contest_ballot($1, $2::jsonb)`, [id, JSON.stringify([c.candidates[0].id, c.candidates[0].id])])),
      ),
    ).toMatch(/invalid_candidate/)
    // Leaving a position blank is fine.
    await ballot(member, id, ['Ada'], c)
    expect(await db.error(() => ballot(member, id, ['Chidi'], c))).toMatch(/already_voted/)
  })

  it('voter-list cut-off: people who join after the contest was created cannot vote', async () => {
    const id = await create(admin, { members_before_open: true })
    const late = await db.addUser()
    await db.query(`UPDATE profiles SET created_at = now() - interval '30 days' WHERE id = $1`, [late])
    await db.query(`INSERT INTO subgroup_members (subgroup_id, user_id) VALUES ($1, $2)`, [group, late])
    const c = await view(late, id)
    expect(c.group_block).toBe('joined_too_late')
    expect(Number(c.eligible_members)).toBe(2)
    expect(await db.error(() => ballot(late, id, ['Ada'], c))).toMatch(/joined_too_late/)
    await ballot(member, id, ['Ada'], c)
  })

  it('minimum account age keeps brand-new accounts out of group voting', async () => {
    const id = await create(admin, { min_account_days: 7 })
    const fresh = await db.addUser()
    await db.query(`INSERT INTO subgroup_members (subgroup_id, user_id) VALUES ($1, $2)`, [group, fresh])
    const c = await view(fresh, id)
    expect(c.group_block).toBe('account_too_new')
    expect(await db.error(() => ballot(fresh, id, ['Ada'], c))).toMatch(/account_too_new/)
  })

  it('a voter code still lets someone outside the rules vote, once', async () => {
    const id = await create(admin, { allow_code_voters: true, members_before_open: true })
    const [{ code }] = (
      await db.asMember(admin, () => db.query<{ code: string }>(`SELECT generate_contest_codes($1, 1) AS code`, [id]))
    ).rows
    const c = await view(outsider, id)
    expect(c.group_block).toBe('not_member')
    expect(await db.error(() => ballot(outsider, id, ['Ada'], c))).toMatch(/code_required/)
    await ballot(outsider, id, ['Ada'], c, code)
  })

  it('public follow link: signed-out visitors can watch, but only when the organiser allows it', async () => {
    const hidden = await create(admin)
    expect(await db.error(() => view(null, hidden))).toMatch(/not_found/)
    const open = await create(admin, { is_public: true })
    const c = await view(null, open)
    expect(c.title).toBe('Bende Union Executive 2026')
    expect(c.signed_in).toBe(false)
    expect(c.group_block).toBe('sign_in')
    expect(c.is_manager).toBe(false)
    expect(c.codes).toBeNull()
  })

  it('a group owner’s election waits for approval; an admin’s goes live and tells the group', async () => {
    const mine = await create(owner)
    expect((await view(owner, mine)).status).toBe('pending')
    await create(admin)
    const told = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND message LIKE 'New vote in your group%'`, [member])
    expect(told.n).toBe(1)
  })

  it('checks positions when creating', async () => {
    expect(await db.error(() => create(admin, { positions: [] }))).toMatch(/need_1_to_15_positions/)
    expect(
      await db.error(() => create(admin, { positions: [{ title: 'Chairman', max_choices: 3, candidates: [{ name: 'Ada' }, { name: 'Chidi' }] }] })),
    ).toMatch(/bad_max_choices/)
    expect(await db.error(() => create(admin, { positions: [{ title: 'Chairman', candidates: [{ name: 'Ada' }] }] }))).toMatch(/need_2_to_100_candidates/)
  })

  it('announces results once when voting closes: group, voters and organiser', async () => {
    const id = await create(owner, { allow_code_voters: true })
    await db.asMember(admin, () => db.query(`SELECT review_contest($1, true)`, [id]))
    const [{ code }] = (
      await db.asMember(owner, () => db.query<{ code: string }>(`SELECT generate_contest_codes($1, 1) AS code`, [id]))
    ).rows
    const c = await view(member, id)
    await ballot(outsider, id, ['Ada'], c, code)
    // Still open: nothing announced.
    expect((await db.one<{ n: number }>(`SELECT announce_due_contest_results() AS n`)).n).toBe(0)
    await db.query(`UPDATE contests SET ends_at = now() - interval '1 minute' WHERE id = $1`, [id])
    expect((await db.one<{ n: number }>(`SELECT announce_due_contest_results() AS n`)).n).toBe(1)
    const told = await db.query<{ user_id: string }>(`SELECT user_id FROM notifications WHERE message LIKE 'Results are out%' ORDER BY user_id`)
    expect(told.rows.map((r) => r.user_id).sort()).toEqual([owner, member, outsider].sort())
    // Never twice.
    expect(await db.asMember(member, () => db.one<{ ok: boolean }>(`SELECT announce_contest_results($1) AS ok`, [id]))).toEqual({ ok: false })
  })

  it('old contests keep working as one position', async () => {
    const id = await db
      .asMember(admin, () =>
        db.one<{ id: string }>(
          `SELECT create_contest('Best Aba Business', null, $1, true, false, 'live', now() - interval '1 minute', now() + interval '1 day', $2::jsonb) AS id`,
          [group, JSON.stringify([{ name: 'Ada Shoes' }, { name: 'Chidi Bags' }])],
        ),
      )
      .then((r) => r.id)
    const c = await view(member, id)
    expect(c.positions).toHaveLength(1)
    await db.asMember(member, () => db.query(`SELECT cast_contest_vote($1, $2)`, [id, c.candidates[1].id]))
    expect((await view(member, id)).has_voted).toBe(true)
  })
})
