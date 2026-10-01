// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Relationship messaging rules on the real migrations (PGlite Postgres).
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.query(`UPDATE public.dating_settings SET value = 'false'::jsonb`)
})

const react = async (as: string, target: string) => {
  await db.as(as)
  return (await db.one<{ r: Record<string, unknown> }>(`SELECT public.dating_react($1, 'like') AS r`, [target])).r
}

const startChat = async (as: string, target: string) => {
  await db.as(as)
  return (
    await db.one<{ r: { status: string; conversation_id?: string; created?: boolean } }>(
      `SELECT public.dating_start_conversation($1) AS r`,
      [target],
    )
  ).r
}

const directInsert = (as: string, other: string) =>
  db.asRole('authenticated', async () => {
    await db.as(as)
    return db.query(`INSERT INTO public.conversations (user1_id, user2_id) VALUES ($1, $2)`, [as, other])
  })

describe('starting chats from the Relationship area', () => {
  it('free users must match first; two free users who match can chat', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    expect(await startChat(a, b)).toEqual({ status: 'match_required' })

    await react(a, b)
    expect(await startChat(a, b)).toEqual({ status: 'match_required' }) // one-sided like is not a match
    expect((await react(b, a)).matched).toBe(true)

    const first = await startChat(a, b)
    expect(first).toMatchObject({ status: 'ok', created: true })
    // Either side reopens the same chat; no duplicates.
    const again = await startChat(b, a)
    expect(again).toMatchObject({ status: 'ok', created: false, conversation_id: first.conversation_id })
  })

  it('premium members can message before matching', async () => {
    const admin = await db.addUser({ admin: true })
    const vip = await db.addUser()
    const other = await db.addUser()
    await db.as(admin)
    await db.query(`SELECT public.admin_grant_subscription($1, 'premium_monthly', 30)`, [vip])
    expect(await startChat(vip, other)).toMatchObject({ status: 'ok', created: true })
    // The free member still cannot start chats with others they have not matched.
    const third = await db.addUser()
    expect(await startChat(other, third)).toEqual({ status: 'match_required' })
  })

  it('an existing chat can always be reopened', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    await directInsert(a, b) // e.g. an older forum conversation
    expect(await startChat(a, b)).toMatchObject({ status: 'ok', created: false })
  })

  it('refuses blocked and banned members', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    await react(a, b)
    await react(b, a)
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [b, a])
    expect(await startChat(a, b)).toEqual({ status: 'unavailable' })
    const banned = await db.addUser({ banned: true })
    expect(await startChat(banned, a)).toEqual({ status: 'account_restricted' })
  })
})

describe('optional site-wide rule for all new private chats', () => {
  it('is off by default: direct conversations still work', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    await expect(directInsert(a, b)).resolves.toBeTruthy()
  })

  it('when on, blocks unmatched free users at the database, allows matches and premium', async () => {
    await db.as(null)
    await db.query(`UPDATE public.dating_settings SET value = 'true'::jsonb WHERE key = 'restrict_all_new_conversations_to_matches'`)
    const a = await db.addUser()
    const b = await db.addUser()
    await expect(directInsert(a, b)).rejects.toThrow(/match_required/)

    await react(a, b)
    await react(b, a)
    await expect(directInsert(a, b)).resolves.toBeTruthy()

    const admin = await db.addUser({ admin: true })
    const premium = await db.addUser()
    const stranger = await db.addUser()
    await db.as(admin)
    await db.query(`SELECT public.admin_grant_subscription($1, 'premium_monthly', 30)`, [premium])
    await expect(directInsert(premium, stranger)).resolves.toBeTruthy()
  })

  it('only admins can change the rule and read setup status; changes are audited', async () => {
    const user = await db.addUser()
    const admin = await db.addUser({ admin: true })
    await db.asRole('authenticated', async () => {
      await db.as(user)
      const r = await db.query(
        `UPDATE public.dating_settings SET value = 'true'::jsonb WHERE key = 'restrict_all_new_conversations_to_matches' RETURNING key`,
      )
      expect(r.rows).toHaveLength(0) // RLS: no rows visible to non-admins
      await expect(db.query(`SELECT public.admin_dating_setup_status()`)).rejects.toThrow(/Forbidden/)
    })
    await db.as(admin)
    const status = (await db.one<{ s: Record<string, unknown> }>(`SELECT public.admin_dating_setup_status() AS s`)).s
    expect(status).toHaveProperty('paid_plan_active')
    expect(status).toHaveProperty('keys_saved')
    await db.query(`UPDATE public.dating_settings SET value = 'true'::jsonb WHERE key = 'restrict_all_new_conversations_to_matches'`)
    await db.as(null)
    const { n } = await db.one<{ n: number }>(
      `SELECT count(*)::int n FROM public.monetization_audit_log WHERE action = 'dating_settings.update'`,
    )
    expect(n).toBeGreaterThanOrEqual(1)
  })
})
