// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Runs the real migration on an in-process Postgres (PGlite).
let db: Db

type Claim = { user_id: string; email: string; name: string; token: string }
const claim = async () => (await db.query<Claim>(`SELECT * FROM public.premium_invite_claim()`)).rows

/** A free member with an email who ran out of requests `hoursAgo` hours ago. */
async function limitedMember(hoursAgo = 2) {
  const id = await db.addUser()
  await db.query(`UPDATE public.profiles SET email = $1 WHERE id = $2`, [`${id}@example.com`, id])
  await db.query(
    `INSERT INTO public.monetization_events (user_id, event, created_at) VALUES ($1, 'LIKE_LIMIT_REACHED', now() - make_interval(hours => $2))`,
    [id, hoursAgo],
  )
  return id
}

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(
    readFileSync(resolve(__dirname, '../../../supabase/migrations/20261012090000_premium_invite_email.sql'), 'utf8'),
  )
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`
    DELETE FROM public.premium_invites;
    DELETE FROM public.monetization_events;
    UPDATE public.payment_providers SET is_enabled = (provider = 'paystack');
    UPDATE public.subscription_plans SET is_active = true, is_visible = true WHERE code = 'premium_monthly';
  `)
})

describe('premium invitation email', () => {
  it('picks a free member who ran out of requests, once', async () => {
    const id = await limitedMember()
    const rows = await claim()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_id: id, email: `${id}@example.com`, name: 'User' })
    expect(rows[0].token).toMatch(/^[0-9a-f-]{36}$/)
    // A second run the same day, or a new limit the next week, sends nothing.
    expect(await claim()).toHaveLength(0)
    await db.query(`UPDATE public.premium_invites SET last_sent_at = now() - interval '7 days'`)
    expect(await claim()).toHaveLength(0)
  })

  it('invites again after 30 days, with the same unsubscribe link', async () => {
    await limitedMember()
    const [first] = await claim()
    await db.query(`UPDATE public.premium_invites SET last_sent_at = now() - interval '31 days'`)
    const [second] = await claim()
    expect(second.token).toBe(first.token)
  })

  it('leaves out old limits, members without email, banned members and Premium members', async () => {
    await limitedMember(72)
    const noEmail = await limitedMember()
    await db.query(`UPDATE public.profiles SET email = NULL WHERE id = $1`, [noEmail])
    const banned = await limitedMember()
    await db.query(`UPDATE public.profiles SET is_banned = true WHERE id = $1`, [banned])
    const premium = await limitedMember()
    await db.query(
      `INSERT INTO public.user_subscriptions (user_id, plan_id, status, source, starts_at, ends_at)
       SELECT $1, id, 'active', 'admin_grant', now() - interval '1 day', now() + interval '29 days'
       FROM public.subscription_plans WHERE code = 'premium_monthly'`,
      [premium],
    )
    expect(await claim()).toHaveLength(0)
  })

  it('sends nothing while Premium cannot be bought', async () => {
    await limitedMember()
    await db.query(`UPDATE public.payment_providers SET is_enabled = false`)
    expect(await claim()).toHaveLength(0)
    await db.query(`UPDATE public.payment_providers SET is_enabled = true WHERE provider = 'paystack'`)
    await db.query(`UPDATE public.subscription_plans SET is_active = false WHERE tier <> 'free'`)
    expect(await claim()).toHaveLength(0)
  })

  it('stops for good when the member uses the unsubscribe link', async () => {
    await limitedMember()
    const [{ token }] = await claim()
    const ok = await db.asRole('anon', () =>
      db.one<{ ok: boolean }>(`SELECT public.premium_invite_opt_out($1) AS ok`, [token]),
    )
    expect(ok.ok).toBe(true)
    await db.query(`UPDATE public.premium_invites SET last_sent_at = now() - interval '60 days'`)
    expect(await claim()).toHaveLength(0)

    const wrong = await db.one<{ ok: boolean }>(`SELECT public.premium_invite_opt_out(gen_random_uuid()) AS ok`)
    expect(wrong.ok).toBe(false)
  })

  it('cannot be run or read by visitors and members', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(db.asRole(role, () => db.query(`SELECT * FROM public.premium_invite_claim()`))).rejects.toThrow(/permission denied/)
      await expect(db.asRole(role, () => db.query(`SELECT * FROM public.premium_invites`))).rejects.toThrow(/permission denied/)
    }
  })
})
