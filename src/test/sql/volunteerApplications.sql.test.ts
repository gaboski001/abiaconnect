// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Runs the real migration on an in-process Postgres (PGlite). The harness
// keeps admins in its own table; add the live user_roles table the migration
// reads to find who to notify.
const EXTRAS = `
  CREATE TABLE public.user_roles (user_id uuid NOT NULL, role text NOT NULL);
`

let db: Db

const LONG = 'I have helped run our town union group for four years and enjoy it.'
const ANSWERS = [{ question: 'Have you moderated a group before?', answer: 'Yes, a WhatsApp group of 300 people.' }]

type Fields = {
  name?: string
  email?: string
  role?: string
  motivation?: string
  answers?: unknown
  user?: string | null
}

const submit = async (f: Fields = {}) =>
  (
    await db.one<{ id: string }>(
      `SELECT public.volunteer_submit($1, $2, '+234 801 234 5678', 'Umuahia, Nigeria', 'Bende', $3, '3 to 5 hours a week', $4, $5, NULL, $6::jsonb, $7) AS id`,
      [
        f.name ?? 'Ada Nwosu',
        f.email ?? 'ada@example.com',
        f.role ?? 'moderator',
        f.motivation ?? LONG,
        LONG,
        JSON.stringify(f.answers ?? ANSWERS),
        f.user ?? null,
      ],
    )
  ).id

const decide = (id: string, decision: string, admin: string, note: string | null = null) =>
  db.one<{ status: string; admin_note: string | null; reviewed_by: string }>(
    `SELECT * FROM public.volunteer_decide($1, $2, $3, $4)`,
    [id, decision, admin, note],
  )

const notes = async (user: string) =>
  (await db.query<{ message: string }>(`SELECT message FROM public.notifications WHERE user_id = $1 ORDER BY created_at`, [user])).rows

let admin: string

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(EXTRAS)
  await db.exec(
    readFileSync(resolve(__dirname, '../../../supabase/migrations/20261013090000_volunteer_applications.sql'), 'utf8'),
  )
  admin = await db.addUser({ admin: true })
  await db.query(`INSERT INTO public.user_roles VALUES ($1, 'Admin'), ($1, 'Super Admin')`, [admin])
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`DELETE FROM public.volunteer_applications; DELETE FROM public.notifications;`)
})

describe('volunteer applications', () => {
  it('saves an application as waiting, and tells the admins once and the member', async () => {
    const member = await db.addUser()
    const id = await submit({ email: '  Ada@Example.com ', user: member })
    const row = await db.one<Record<string, unknown>>(`SELECT * FROM public.volunteer_applications WHERE id = $1`, [id])
    expect(row).toMatchObject({ email: 'ada@example.com', status: 'pending', role: 'moderator', user_id: member, lga: 'Bende' })
    expect(row.answers).toEqual(ANSWERS)
    expect(await notes(admin)).toHaveLength(1)
    expect((await notes(admin))[0].message).toContain('Ada Nwosu')
    expect(await notes(member)).toHaveLength(1)
  })

  it('refuses incomplete or malformed applications', async () => {
    await expect(submit({ name: 'A' })).rejects.toThrow(/name_invalid/)
    await expect(submit({ email: 'not-an-email' })).rejects.toThrow(/email_invalid/)
    await expect(submit({ role: 'president' })).rejects.toThrow(/role_invalid/)
    await expect(submit({ motivation: 'Too short.' })).rejects.toThrow(/text_invalid/)
    await expect(submit({ answers: { question: 'x' } })).rejects.toThrow(/answers_invalid/)
    await expect(submit({ answers: [{ question: 'q', answer: 'a', extra: 'x' }] })).rejects.toThrow(/answers_invalid/)
    await expect(submit({ answers: Array(7).fill(ANSWERS[0]) })).rejects.toThrow(/answers_invalid/)
  })

  it('allows one application under review per email, and three in 30 days', async () => {
    const first = await submit()
    await expect(submit({ email: 'ADA@example.com', role: 'writer' })).rejects.toThrow(/already_pending/)
    await decide(first, 'decline', admin)
    const second = await submit()
    await decide(second, 'decline', admin)
    const third = await submit()
    await decide(third, 'decline', admin)
    await expect(submit()).rejects.toThrow(/too_many/)
  })

  it('approves with a note and tells the member; the decision is then final', async () => {
    const member = await db.addUser()
    const id = await submit({ user: member })
    const row = await decide(id, 'approve', admin, '  Welcome aboard.  ')
    expect(row).toMatchObject({ status: 'approved', admin_note: 'Welcome aboard.', reviewed_by: admin })
    expect((await notes(member)).at(-1)!.message).toContain('approved')
    await expect(decide(id, 'decline', admin)).rejects.toThrow(/already_decided/)
    await expect(decide(id, 'ignore', admin)).rejects.toThrow(/already_decided/)
  })

  it('ignores quietly, and an ignored application can still be decided', async () => {
    const member = await db.addUser()
    const id = await submit({ user: member })
    expect((await decide(id, 'ignore', admin)).status).toBe('ignored')
    expect(await notes(member)).toHaveLength(1) // only the "we received it" note
    expect((await decide(id, 'decline', admin)).status).toBe('declined')
    expect(await notes(member)).toHaveLength(2)
  })

  it('only lets admins decide', async () => {
    const member = await db.addUser()
    const id = await submit()
    await expect(decide(id, 'approve', member)).rejects.toThrow(/not_admin/)
    await expect(decide(id, 'promote', admin)).rejects.toThrow(/decision_invalid/)
    await expect(decide('00000000-0000-4000-8000-000000000000', 'approve', admin)).rejects.toThrow(/not_found/)
  })

  it('keeps applications private: only admins can read, nobody can write directly', async () => {
    const member = await db.addUser()
    await submit()
    for (const role of ['anon', 'authenticated'] as const) {
      await expect(db.asRole(role, () => submit({ email: 'x@example.com' }))).rejects.toThrow(/permission denied/)
      await expect(
        db.asRole(role, () => db.query(`UPDATE public.volunteer_applications SET status = 'approved'`)),
      ).rejects.toThrow(/permission denied/)
    }
    await expect(db.asRole('anon', () => db.query(`SELECT * FROM public.volunteer_applications`))).rejects.toThrow(
      /permission denied/,
    )
    const seenBy = async (user: string) => {
      await db.as(user)
      const rows = await db.asRole('authenticated', () => db.query(`SELECT id FROM public.volunteer_applications`))
      await db.as(null)
      return rows.rows.length
    }
    expect(await seenBy(member)).toBe(0)
    expect(await seenBy(admin)).toBe(1)
  })
})
