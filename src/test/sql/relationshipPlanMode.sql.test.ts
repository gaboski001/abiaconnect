// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

let db: Db
beforeAll(async () => {
  db = await createMonetizationDb()
  const sql = readFileSync(resolve(__dirname, '../../../drizzle/migrations/0018_relationship_plan_mode_and_thread_image_access.sql'), 'utf8')
  await db.exec(sql.split('CREATE POLICY "Read attachments')[0])
}, 60_000)
beforeEach(async () => {
  await db.as(null)
  await db.query('UPDATE public.relationship_access_settings SET plans_enabled = true')
})
async function setMode(enabled: boolean) {
  const admin = await db.addUser({ admin: true })
  await db.as(admin)
  await db.query('SELECT public.admin_set_relationship_plan_mode($1)', [enabled])
}
describe('relationship plan mode', () => {
  it('defaults to existing plan-based access', async () => {
    const member = await db.addUser()
    await db.as(member)
    expect((await db.one<{ e: { is_premium: boolean } }>('SELECT public.get_my_dating_entitlements() e')).e.is_premium).toBe(false)
  })
  it('only admins may switch modes, with an audit record', async () => {
    const member = await db.addUser()
    await db.as(member)
    await expect(db.query('SELECT public.admin_set_relationship_plan_mode(false)')).rejects.toThrow(/Admins only/)
    await setMode(false)
    await db.as(null)
    expect((await db.one<{ n: number }>("SELECT count(*)::int n FROM public.monetization_audit_log WHERE action='relationship.plan_mode'")).n).toBeGreaterThan(0)
  })
  it('off gives every member premium access and unlimited connections', async () => {
    await setMode(false)
    const me = await db.addUser()
    await db.as(me)
    expect((await db.one<{ e: unknown }>('SELECT public.get_my_dating_entitlements() e')).e).toMatchObject({
      is_premium: true, tier: 'premium', ends_at: null, limits: { daily_likes: null, see_likes: true, message_without_match: true, send_before_reply: true },
    })
    const targets = await Promise.all(Array.from({ length: 30 }, () => db.addUser()))
    await db.as(me)
    for (const target of targets) {
      expect((await db.one<{ r: { status: string } }>("SELECT public.dating_react($1, 'like') r", [target])).r.status).toBe('ok')
    }
  })
  it('off reveals incoming likes', async () => {
    await setMode(false)
    const me = await db.addUser(), fan = await db.addUser()
    await db.as(fan)
    await db.query("SELECT public.dating_react($1, 'like')", [me])
    await db.as(me)
    expect((await db.one<{ r: { items: unknown[] } }>('SELECT public.dating_likes_received() r')).r.items).toMatchObject([{ user_id: fan }])
  })
  it('off permits unmatched chats and multiple messages before a reply', async () => {
    await setMode(false)
    const me = await db.addUser(), other = await db.addUser()
    await db.as(me)
    const { r } = await db.one<{ r: { status: string; conversation_id: string } }>('SELECT public.dating_start_conversation($1) r', [other])
    expect(r.status).toBe('ok')
    for (let i = 0; i < 3; i++) {
      await db.asRole('authenticated', () => db.query('INSERT INTO public.messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)', [r.conversation_id, me, `Hello ${i}`]))
    }
    expect((await db.one<{ n: number }>('SELECT count(*)::int n FROM public.messages WHERE conversation_id=$1', [r.conversation_id])).n).toBe(3)
  })
  it('on restores free rules without deleting paid subscriptions', async () => {
    const admin = await db.addUser({ admin: true }), paid = await db.addUser(), free = await db.addUser()
    await db.as(admin)
    await db.query("SELECT public.admin_grant_subscription($1, 'premium_monthly', 30)", [paid])
    await setMode(false)
    await setMode(true)
    await db.as(free)
    expect((await db.one<{ e: { is_premium: boolean } }>('SELECT public.get_my_dating_entitlements() e')).e.is_premium).toBe(false)
    await db.as(paid)
    expect((await db.one<{ e: { is_premium: boolean } }>('SELECT public.get_my_dating_entitlements() e')).e.is_premium).toBe(true)
  })
  it('off still protects blocked, banned and private-message recipients', async () => {
    await setMode(false)
    const me = await db.addUser(), other = await db.addUser(), banned = await db.addUser({ banned: true })
    await db.as(null)
    await db.query("UPDATE public.profiles SET message_privacy='nobody' WHERE id=$1", [other])
    await db.as(me)
    expect((await db.one<{ r: { status: string } }>('SELECT public.dating_start_conversation($1) r', [other])).r.status).toBe('messages_off')
    expect((await db.one<{ r: { status: string } }>('SELECT public.dating_start_conversation($1) r', [banned])).r.status).toBe('unavailable')
    await db.as(null)
    await db.query('INSERT INTO public.relationship_blocks VALUES ($1,$2)', [me, other])
    await db.as(me)
    expect((await db.one<{ r: { status: string } }>('SELECT public.dating_start_conversation($1) r', [other])).r.status).toBe('unavailable')
  })
})