// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createForumDb, type ForumDb } from './forumHarness'

// Each test builds a fresh Postgres; give it room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const points = async (db: ForumDb, uid: string) =>
  (await db.one<{ points: number }>(`SELECT COALESCE((SELECT points FROM member_stats WHERE user_id = $1), 0) AS points`, [uid])).points

const newThread = async (db: ForumDb, uid: string) =>
  (await db.asMember(uid, () => db.one<{ id: string }>(`INSERT INTO threads (author_id) VALUES ($1) RETURNING id`, [uid]))).id

describe('forum points', () => {
  let db: ForumDb
  let ada: string
  let ben: string
  beforeEach(async () => {
    db = await createForumDb()
    ada = await db.addUser()
    ben = await db.addUser()
  })

  it('pays for posting and replying, and mirrors the total into reputation', async () => {
    const t = await newThread(db, ada)
    await db.asMember(ada, () => db.query(`INSERT INTO replies (thread_id, user_id) VALUES ($1, $2)`, [t, ada]))
    expect(await points(db, ada)).toBe(20)
    expect((await db.one<{ reputation: number }>(`SELECT reputation FROM profiles WHERE id = $1`, [ada])).reputation).toBe(20)
  })

  it('caps daily earnings so posting can’t be farmed', async () => {
    for (let i = 0; i < 5; i++) await newThread(db, ada)
    expect(await points(db, ada)).toBe(45) // 3 discussions' worth
  })

  it('pays authors for upvotes from others, once per voter, never for self-votes', async () => {
    const t = await newThread(db, ada)
    await db.asMember(ada, () => db.query(`INSERT INTO thread_votes (thread_id, user_id, value) VALUES ($1, $2, 1)`, [t, ada]))
    expect(await points(db, ada)).toBe(15)
    await db.asMember(ben, () => db.query(`INSERT INTO thread_votes (thread_id, user_id, value) VALUES ($1, $2, 1)`, [t, ben]))
    expect(await points(db, ada)).toBe(17)
    await db.asMember(ben, async () => {
      await db.query(`DELETE FROM thread_votes WHERE thread_id = $1 AND user_id = $2`, [t, ben])
      await db.query(`INSERT INTO thread_votes (thread_id, user_id, value) VALUES ($1, $2, 1)`, [t, ben])
    })
    expect(await points(db, ada)).toBe(17)
  })

  it('takes points back when a post is removed', async () => {
    const t = await newThread(db, ada)
    await db.query(`UPDATE threads SET is_deleted = true WHERE id = $1`, [t])
    expect(await points(db, ada)).toBe(0)
  })

  it('gives banned members nothing', async () => {
    const bad = await db.addUser({ banned: true })
    await newThread(db, bad)
    expect(await points(db, bad)).toBe(0)
  })

  it('members cannot give themselves points or edit their reputation', async () => {
    await newThread(db, ada)
    const err = await db.error(() =>
      db.asMember(ada, () => db.query(`INSERT INTO points_ledger (user_id, amount, reason) VALUES ($1, 1000, 'admin_adjust')`, [ada])),
    )
    expect(err).toMatch(/permission denied/)
    expect(
      await db.error(() => db.asMember(ada, () => db.query(`UPDATE member_stats SET points = 9999 WHERE user_id = $1`, [ada]))),
    ).toMatch(/permission denied/)
    await db.asMember(ada, () => db.query(`UPDATE profiles SET reputation = 9999 WHERE id = $1`, [ada]))
    expect((await db.one<{ reputation: number }>(`SELECT reputation FROM profiles WHERE id = $1`, [ada])).reputation).toBe(15)
    expect(await db.error(() => db.asMember(ada, () => db.query(`SELECT award_points($1, 500, 'admin_adjust', 'x')`, [ada])))).toMatch(
      /permission denied/,
    )
  })

  it('awards a badge for the first post and tells the member', async () => {
    await newThread(db, ada)
    expect((await db.query(`SELECT badge FROM member_badges WHERE user_id = $1`, [ada])).rows).toEqual([{ badge: 'first_post' }])
    expect((await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = 'reward'`, [ada])).n).toBe(1)
  })
})

describe('daily reward', () => {
  let db: ForumDb
  let ada: string
  beforeEach(async () => {
    db = await createForumDb()
    ada = await db.addUser()
  })
  const claim = () => db.asMember(ada, () => db.one<{ r: Record<string, unknown> }>(`SELECT claim_daily_reward() AS r`)).then((x) => x.r)

  it('can be claimed once a day', async () => {
    expect(await claim()).toMatchObject({ claimed: true, earned: 10, streak: 1 })
    expect(await claim()).toMatchObject({ claimed: false, already_claimed: true })
    expect(await points(db, ada)).toBe(10)
  })

  it('grows with a streak and resets after a missed day', async () => {
    await claim()
    await db.query(`UPDATE member_stats SET last_checkin = community_today() - 1, current_streak = 5 WHERE user_id = $1`, [ada])
    await db.query(`DELETE FROM points_ledger WHERE user_id = $1`, [ada])
    expect(await claim()).toMatchObject({ earned: 20, streak: 6 })

    await db.query(`UPDATE member_stats SET last_checkin = community_today() - 1, current_streak = 6 WHERE user_id = $1`, [ada])
    await db.query(`DELETE FROM points_ledger WHERE user_id = $1`, [ada])
    expect(await claim()).toMatchObject({ earned: 42, bonus: 20, streak: 7 })
    expect((await db.query(`SELECT 1 FROM member_badges WHERE user_id = $1 AND badge = 'streak_7'`, [ada])).rows).toHaveLength(1)

    await db.query(`UPDATE member_stats SET last_checkin = community_today() - 3 WHERE user_id = $1`, [ada])
    await db.query(`DELETE FROM points_ledger WHERE user_id = $1`, [ada])
    expect(await claim()).toMatchObject({ earned: 10, streak: 1 })
  })

  it('reports rewards for the rewards screen', async () => {
    await claim()
    const r = (await db.asMember(ada, () => db.one<{ r: Record<string, unknown> }>(`SELECT get_my_rewards() AS r`))).r
    expect(r).toMatchObject({ points: 10, level: 1, current_streak: 1, claimed_today: true })
  })
})

describe('leaderboard', () => {
  it('ranks members by points and leaves out banned accounts', async () => {
    const db = await createForumDb()
    const ada = await db.addUser()
    const ben = await db.addUser()
    const bad = await db.addUser()
    await newThread(db, ada)
    await newThread(db, ada)
    await newThread(db, ben)
    await newThread(db, bad)
    await db.query(`UPDATE profiles SET is_banned = true WHERE id = $1`, [bad])
    const rows = (await db.asMember(ben, () => db.query(`SELECT user_id, points, rank FROM get_leaderboard('week')`))).rows as Array<{
      user_id: string
      points: number
      rank: number
    }>
    expect(rows.map((r) => r.user_id)).toEqual([ada, ben])
    expect(rows.map((r) => Number(r.points))).toEqual([30, 15])
    const me = (await db.asMember(ben, () => db.one<{ r: { rank: number } }>(`SELECT get_my_rank('week') AS r`))).r
    expect(Number(me.rank)).toBe(2)
  })

  it('gives existing members starting points from their past activity', async () => {
    let author = ''
    const db = await createForumDb(async (d) => {
      author = await d.addUser()
      const voter = await d.addUser()
      const t = (await d.one<{ id: string }>(`INSERT INTO threads (author_id) VALUES ($1) RETURNING id`, [author])).id
      await d.query(`INSERT INTO replies (thread_id, user_id) VALUES ($1, $2)`, [t, author])
      await d.query(`INSERT INTO thread_votes (thread_id, user_id, value) VALUES ($1, $2, 1)`, [t, voter])
    })
    expect(await points(db, author)).toBe(22)
    expect((await db.one<{ reputation: number }>(`SELECT reputation FROM profiles WHERE id = $1`, [author])).reputation).toBe(22)
    // History badges are given quietly, without a burst of notifications.
    expect((await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications`)).n).toBe(0)
  })
})
