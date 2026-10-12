// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Runs the real migration on an in-process Postgres (PGlite).
let db: Db
let ada: string
let obi: string

/** Run a query as a signed-in member. */
async function asUser<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
  await db.as(user)
  try {
    return (await db.asRole('authenticated', () => db.query<T>(sql, params))).rows
  } finally {
    await db.as(null)
  }
}
const save = (user: string, phone: string, owner = user) =>
  asUser(
    user,
    `INSERT INTO public.whatsapp_contacts (user_id, phone) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone`,
    [owner, phone],
  )
const row = async (user: string) =>
  (await db.query<{ phone: string; opted_in_at: Date; updated_at: Date }>(`SELECT * FROM public.whatsapp_contacts WHERE user_id = $1`, [user])).rows[0]

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261014090000_whatsapp_contacts.sql'), 'utf8'))
  ada = await db.addUser()
  obi = await db.addUser()
}, 60_000)

beforeEach(async () => {
  await db.as(null)
  await db.exec(`DELETE FROM public.whatsapp_contacts`)
})

describe('WhatsApp numbers', () => {
  it('lets a member save, change and remove their own number', async () => {
    await save(ada, '+2348012345678')
    expect((await asUser(ada, `SELECT phone FROM public.whatsapp_contacts`))).toEqual([{ phone: '+2348012345678' }])
    await save(ada, '+447911123456')
    expect((await row(ada)).phone).toBe('+447911123456')
    await asUser(ada, `DELETE FROM public.whatsapp_contacts WHERE user_id = $1`, [ada])
    expect(await row(ada)).toBeUndefined()
  })

  it('keeps every number private to its owner', async () => {
    await save(ada, '+2348012345678')
    expect(await asUser(obi, `SELECT * FROM public.whatsapp_contacts`)).toEqual([])
    await asUser(obi, `UPDATE public.whatsapp_contacts SET phone = '+2348099999999'`)
    await asUser(obi, `DELETE FROM public.whatsapp_contacts`)
    expect((await row(ada)).phone).toBe('+2348012345678')
    await expect(save(obi, '+2348099999999', ada)).rejects.toThrow(/row-level security/)
    await expect(db.asRole('anon', () => db.query(`SELECT * FROM public.whatsapp_contacts`))).rejects.toThrow(/permission denied/)
  })

  it('accepts only numbers in international format', async () => {
    for (const bad of ['08012345678', '2348012345678', '+234 801 234 5678', '+0801234567', '+12', 'hello']) {
      await expect(save(ada, bad)).rejects.toThrow(/check constraint/)
    }
  })

  it('sets the permission date itself, and renews it only when the number changes', async () => {
    await asUser(ada, `INSERT INTO public.whatsapp_contacts (user_id, phone, opted_in_at) VALUES ($1, '+2348012345678', '2020-01-01')`, [ada])
    const first = await row(ada)
    expect(first.opted_in_at.getFullYear()).toBeGreaterThan(2020)

    await db.query(`UPDATE public.whatsapp_contacts SET opted_in_at = now() - interval '10 days' WHERE user_id = $1`, [ada])
    // The trigger keeps the old date on an update that does not change the number...
    const kept = (await row(ada)).opted_in_at.getTime()
    await save(ada, '+2348012345678')
    expect((await row(ada)).opted_in_at.getTime()).toBe(kept)
    // ...and renews it for a new number.
    await save(ada, '+2348087654321')
    expect((await row(ada)).opted_in_at.getTime()).toBeGreaterThan(kept)
  })

  it('removes the number when the account is deleted', async () => {
    const gone = await db.addUser()
    await save(gone, '+2348012345678')
    await db.query(`DELETE FROM auth.users WHERE id = $1`, [gone])
    expect(await row(gone)).toBeUndefined()
  })
})
