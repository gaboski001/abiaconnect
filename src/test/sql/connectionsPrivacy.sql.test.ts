// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Member privacy controls and the first-message anti-spam rule, on the real
// migrations with production-like row-level security (PGlite Postgres).
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.query(`UPDATE public.dating_settings SET value = '1'::jsonb WHERE key = 'first_messages_before_reply'`)
  await db.query(`UPDATE public.subscription_plans SET limits = limits || '{"daily_likes": 50}'::jsonb WHERE code = 'free'`)
})

const connect = async (a: string, b: string) => {
  for (const [x, y] of [[a, b], [b, a]]) {
    await db.as(x)
    await db.query(`SELECT public.dating_react($1, 'like')`, [y])
  }
}

/** Run SQL as a signed-in member, through row-level security. */
const asMember = <T>(user: string, fn: () => Promise<T>) =>
  db.asRole('authenticated', async () => {
    await db.as(user)
    return fn()
  })

const newConversation = (a: string, b: string) =>
  asMember(a, () =>
    db.query<{ id: string }>(`INSERT INTO public.conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING id`, [a, b]),
  ).then((r) => r.rows[0].id)

const send = (user: string, conversation: string, content = 'Hello') =>
  asMember(user, () =>
    db.query(`INSERT INTO public.messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)`, [conversation, user, content]),
  )

const sendStatus = (user: string, conversation: string) =>
  asMember(user, async () => (await db.one<{ s: Record<string, unknown> }>(`SELECT public.conversation_send_status($1) AS s`, [conversation])).s)

describe('first-message anti-spam', () => {
  it('free members send one message, then wait for a reply; after a reply the chat flows', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    const c = await newConversation(a, b)

    await send(a, c, 'Hello, I saw your post about the trade fair.')
    expect(await sendStatus(a, c)).toMatchObject({ can_send: false, remaining: 0 })
    await expect(send(a, c, 'Are you there?')).rejects.toThrow(/awaiting_reply/)

    await send(b, c, 'Hi! Yes, happy to talk.')
    expect(await sendStatus(a, c)).toMatchObject({ can_send: true })
    await send(a, c, 'Great')
    await send(a, c, 'Here are the details…')
  })

  it('call logs do not count, admins can raise the allowance, premium members are exempt', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    const c = await newConversation(a, b)
    await send(a, c, '[call:missed] No answer')
    await send(a, c, 'Sorry I missed you')
    await expect(send(a, c, 'Again')).rejects.toThrow(/awaiting_reply/)

    await db.as(null)
    await db.query(`UPDATE public.dating_settings SET value = '3'::jsonb WHERE key = 'first_messages_before_reply'`)
    await send(a, c, 'Second')
    await send(a, c, 'Third')
    await expect(send(a, c, 'Fourth')).rejects.toThrow(/awaiting_reply/)

    const admin = await db.addUser({ admin: true })
    const premium = await db.addUser()
    await db.as(admin)
    await db.query(`SELECT public.admin_grant_subscription($1, 'premium_monthly', 30)`, [premium])
    const c2 = await newConversation(premium, b)
    for (let i = 0; i < 4; i++) await send(premium, c2, `Message ${i}`)
  })
})

describe('who can message me', () => {
  it('"No one" blocks new chats from Connections and directly; admins are exempt; old chats still work', async () => {
    const quiet = await db.addUser()
    const a = await db.addUser()
    const old = await newConversation(a, quiet)
    await asMember(quiet, () => db.query(`SELECT public.set_my_privacy('nobody')`))

    await db.as(a)
    expect((await db.one<{ r: { status: string } }>(`SELECT public.dating_start_conversation($1) AS r`, [quiet])).r.status).toBe(
      'ok', // the existing chat reopens
    )
    const b = await db.addUser()
    await db.as(b)
    expect((await db.one<{ r: { status: string } }>(`SELECT public.dating_start_conversation($1) AS r`, [quiet])).r.status).toBe(
      'messages_off',
    )
    await expect(newConversation(b, quiet)).rejects.toThrow(/messages_off/)
    await send(a, old, 'Still works in an existing chat')

    const admin = await db.addUser({ admin: true })
    await expect(newConversation(admin, quiet)).resolves.toBeTruthy()
  })

  it('"My connections only" allows mutual connections, refuses others', async () => {
    const owner = await db.addUser()
    const friend = await db.addUser()
    const stranger = await db.addUser()
    await asMember(owner, () => db.query(`SELECT public.set_my_privacy('connections')`))
    await connect(owner, friend)

    await db.as(stranger)
    expect((await db.one<{ r: { status: string } }>(`SELECT public.dating_start_conversation($1) AS r`, [owner])).r.status).toBe(
      'connections_only',
    )
    await expect(newConversation(stranger, owner)).rejects.toThrow(/connections_only/)
    await db.as(friend)
    expect((await db.one<{ r: { status: string } }>(`SELECT public.dating_start_conversation($1) AS r`, [owner])).r.status).toBe('ok')
  })

  it('validates the setting and reports it back', async () => {
    const u = await db.addUser()
    await expect(asMember(u, () => db.query(`SELECT public.set_my_privacy('friends')`))).rejects.toThrow(/Invalid message setting/)
    const r = await asMember(u, async () => (await db.one<{ p: Record<string, unknown> }>(`SELECT public.set_my_privacy('connections', true) AS p`)).p)
    expect(r).toEqual({ message_privacy: 'connections', incognito: true, has_connections_profile: true })
  })
})

describe('private mode and blocks in the directory', () => {
  const canSee = (viewer: string, owner: string) =>
    asMember(viewer, async () =>
      (await db.query(`SELECT 1 FROM public.relationship_profiles WHERE user_id = $1`, [owner])).rows.length === 1,
    )

  it('private members are hidden, except from people they reached out to and their connections', async () => {
    const priv = await db.addUser()
    const contacted = await db.addUser()
    const connection = await db.addUser()
    const other = await db.addUser()
    await asMember(priv, () => db.query(`SELECT public.set_my_privacy(NULL, true)`))

    expect(await canSee(other, priv)).toBe(false)
    expect(await canSee(priv, priv)).toBe(true)

    await db.as(priv)
    await db.query(`SELECT public.dating_react($1, 'like')`, [contacted])
    expect(await canSee(contacted, priv)).toBe(true)

    await connect(priv, connection)
    expect(await canSee(connection, priv)).toBe(true)
    expect(await canSee(other, priv)).toBe(false)
  })

  it('blocking hides profiles in both directions', async () => {
    const blocker = await db.addUser()
    const blocked = await db.addUser()
    expect(await canSee(blocked, blocker)).toBe(true)
    await asMember(blocker, () => db.query(`INSERT INTO public.relationship_blocks (user_id, blocked_id) VALUES ($1, $2)`, [blocker, blocked]))
    expect(await canSee(blocked, blocker)).toBe(false) // previously still visible
    expect(await canSee(blocker, blocked)).toBe(false)
  })

  it('members cannot probe who reached out to whom', async () => {
    const u = await db.addUser()
    const [x, y] = await Promise.all([db.addUser(), db.addUser()])
    await asMember(u, () => expect(db.query(`SELECT public.dating_has_reached_out($1, $2)`, [x, y])).rejects.toThrow(/permission denied/))
    await asMember(u, () => expect(db.query(`SELECT public.dating_is_match($1, $2)`, [x, y])).rejects.toThrow(/permission denied/))
  })
})
