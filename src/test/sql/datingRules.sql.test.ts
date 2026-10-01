// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Deep checks of the dating rules on the real migrations (PGlite Postgres).
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.query(`UPDATE public.subscription_plans SET limits = limits || '{"daily_likes": 2}'::jsonb WHERE code = 'free'`)
})

const react = async (as: string, target: string, kind: 'like' | 'pass') => {
  await db.as(as)
  return (await db.one<{ r: Record<string, unknown> }>(`SELECT public.dating_react($1, $2) AS r`, [target, kind])).r
}

const usage = async (user: string) => {
  await db.as(null)
  const r = await db.one<{ count: number } | undefined>(
    `SELECT count FROM public.feature_usage WHERE user_id = $1 AND feature = 'like' AND period_start = public.dating_today()`,
    [user],
  )
  return r?.count ?? 0
}

const entitlements = async (user: string) => {
  await db.as(user)
  return (
    await db.one<{ e: { is_premium: boolean; limits: { daily_likes?: number | null } } }>(
      `SELECT public.get_my_dating_entitlements() AS e`,
    )
  ).e
}

const likesReceived = async (user: string, args = '') => {
  await db.as(user)
  return (
    await db.one<{ r: { total: number; unseen: number; items: Array<{ user_id: string }> } }>(
      `SELECT public.dating_likes_received(${args}) AS r`,
    )
  ).r
}

const grantPremium = async (admin: string, user: string, days = 30) => {
  await db.as(admin)
  await db.query(`SELECT public.admin_grant_subscription($1, 'premium_monthly', $2)`, [user, days])
}

describe('daily likes', () => {
  it('resets the allowance at the start of the next day (Africa/Lagos)', async () => {
    const me = await db.addUser()
    const [a, b, c] = await Promise.all([db.addUser(), db.addUser(), db.addUser()])
    await react(me, a, 'like')
    await react(me, b, 'like')
    expect((await react(me, c, 'like')).status).toBe('limit_reached')
    // Simulate midnight: move the counter to yesterday.
    await db.as(null)
    await db.query(`UPDATE public.feature_usage SET period_start = period_start - 1 WHERE user_id = $1`, [me])
    expect(await react(me, c, 'like')).toMatchObject({ status: 'ok', likes_remaining: 1 })
  })

  it('never charges passes; a like after a pass is charged once', async () => {
    const me = await db.addUser()
    const t = await db.addUser()
    await react(me, t, 'pass')
    await react(me, t, 'pass')
    expect(await usage(me)).toBe(0)
    await react(me, t, 'like')
    expect(await usage(me)).toBe(1)
    await react(me, t, 'like')
    expect(await usage(me)).toBe(1)
  })

  it('premium likes are unlimited and not counted', async () => {
    const admin = await db.addUser({ admin: true })
    const me = await db.addUser()
    await grantPremium(admin, me)
    const targets = await Promise.all(Array.from({ length: 6 }, () => db.addUser()))
    for (const t of targets) expect((await react(me, t, 'like')).status).toBe('ok')
    expect(await usage(me)).toBe(0)
    expect((await entitlements(me)).limits.daily_likes).toBeNull()
  })

  it('returns to the free limit when premium expires or is revoked', async () => {
    const admin = await db.addUser({ admin: true })
    const me = await db.addUser()
    await grantPremium(admin, me)
    await db.as(null)
    await db.query(
      `UPDATE public.user_subscriptions SET starts_at = now() - interval '40 days', ends_at = now() - interval '1 day' WHERE user_id = $1`,
      [me],
    )
    expect((await entitlements(me)).is_premium).toBe(false)
    const more = await Promise.all([db.addUser(), db.addUser(), db.addUser()])
    expect((await react(me, more[0], 'like')).status).toBe('ok')
    expect((await react(me, more[1], 'like')).status).toBe('ok')
    expect((await react(me, more[2], 'like')).status).toBe('limit_reached')

    await grantPremium(admin, me, 7)
    expect((await react(me, more[2], 'like')).status).toBe('ok')
    await db.as(null)
    const { id } = await db.one<{ id: string }>(
      `SELECT id FROM public.user_subscriptions WHERE user_id = $1 AND status = 'active' AND ends_at > now()`,
      [me],
    )
    await db.as(admin)
    await db.query(`SELECT public.admin_revoke_subscription($1)`, [id])
    expect((await entitlements(me)).is_premium).toBe(false)
  })
})

describe('likes you, matches, notifications', () => {
  it('pages results, filters new ones, and only premium users can mark them seen', async () => {
    const admin = await db.addUser({ admin: true })
    const me = await db.addUser()
    const fans = await Promise.all(Array.from({ length: 5 }, () => db.addUser()))
    for (const f of fans) await react(f, me, 'like')

    await db.as(me)
    await db.query(`SELECT public.dating_mark_likes_seen()`)
    expect(await likesReceived(me)).toMatchObject({ total: 5, unseen: 5, items: [] })

    await grantPremium(admin, me)
    const ids = [
      ...(await likesReceived(me, '2, 0')).items,
      ...(await likesReceived(me, '2, 2')).items,
      ...(await likesReceived(me, '2, 4')).items,
    ].map((i) => i.user_id)
    expect(ids).toHaveLength(5)
    expect(new Set(ids)).toEqual(new Set(fans))

    await db.as(me)
    await db.query(`SELECT public.dating_mark_likes_seen()`)
    expect(await likesReceived(me)).toMatchObject({ total: 5, unseen: 0 })
    expect((await likesReceived(me, '20, 0, true')).items).toHaveLength(0)

    // Liking a fan back makes a match and removes them from the pending list.
    await react(me, fans[0], 'like')
    expect((await likesReceived(me)).total).toBe(4)
  })

  it('hides blocked and banned people from matches and likes', async () => {
    await db.as(null)
    await db.query(`UPDATE public.subscription_plans SET limits = limits || '{"daily_likes": 10}'::jsonb WHERE code = 'free'`)
    const me = await db.addUser()
    const blocked = await db.addUser()
    const banned = await db.addUser()
    const ok = await db.addUser()
    for (const u of [blocked, banned, ok]) {
      await react(u, me, 'like')
      await react(me, u, 'like')
    }
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [me, blocked])
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [banned])
    await db.as(me)
    const matches = (await db.one<{ m: Array<{ user_id: string }> }>(`SELECT public.dating_my_matches() AS m`)).m
    expect(matches.map((m) => m.user_id)).toEqual([ok])

    const fan = await db.addUser()
    await react(fan, me, 'like')
    await db.as(null)
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [fan])
    expect((await likesReceived(me)).total).toBe(0)
  })

  it('sends at most one anonymous like notification per 6 hours', async () => {
    const me = await db.addUser()
    const fans = await Promise.all([db.addUser(), db.addUser(), db.addUser()])
    for (const f of fans) await react(f, me, 'like')
    await db.as(null)
    const notes = await db.query<{ message: string }>(
      `SELECT message FROM public.notifications WHERE user_id = $1 AND type = 'dating_like'`,
      [me],
    )
    expect(notes.rows).toHaveLength(1)
    expect(notes.rows[0].message).toBe('Someone liked your dating profile.')
  })

  it('rejects signed-out callers', async () => {
    const t = await db.addUser()
    await db.as(null)
    await expect(db.query(`SELECT public.dating_react($1, 'like')`, [t])).rejects.toThrow(/Not authenticated/)
    await expect(db.query(`SELECT public.dating_likes_received()`)).rejects.toThrow(/Not authenticated/)
    await expect(db.query(`SELECT public.get_my_dating_entitlements()`)).rejects.toThrow(/Not authenticated/)
  })
})
