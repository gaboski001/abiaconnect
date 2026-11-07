// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

let db: Db
let champion: string
let other: string
let admin: string

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(`
    CREATE TABLE public.group_champions (
      subgroup_id uuid NOT NULL, user_id uuid NOT NULL, added_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (subgroup_id, user_id)
    );
    ALTER TABLE public.group_champions ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.group_champions TO anon, authenticated;
    CREATE POLICY "Champions are public" ON public.group_champions FOR SELECT USING (true);
  `)
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261107130000_lock_group_champions.sql'), 'utf8'))
  champion = await db.addUser()
  other = await db.addUser()
  admin = await db.addUser({ admin: true })
  await db.as(null)
  await db.query(`INSERT INTO public.group_champions (subgroup_id, user_id) VALUES (gen_random_uuid(), $1), (gen_random_uuid(), $2)`, [champion, other])
}, 60_000)

const seenBy = (user: string) =>
  db.asRole('authenticated', async () => {
    await db.as(user)
    return (await db.query<{ user_id: string }>(`SELECT user_id FROM public.group_champions`)).rows.map((r) => r.user_id)
  })

describe('champions list', () => {
  it('is closed to people who are not signed in', async () => {
    await expect(db.asRole('anon', () => db.query(`SELECT * FROM public.group_champions`))).rejects.toThrow(/permission/)
  })

  it('shows a champion only their own row, and everyone else nothing more', async () => {
    expect(await seenBy(champion)).toEqual([champion])
    expect(await seenBy(await db.addUser())).toEqual([])
  })

  it('shows admins the whole list', async () => {
    expect((await seenBy(admin)).sort()).toEqual([champion, other].sort())
  })

  it('cannot be changed directly', async () => {
    await expect(
      db.asRole('authenticated', async () => {
        await db.as(admin)
        return db.query(`DELETE FROM public.group_champions`)
      }),
    ).rejects.toThrow(/permission/)
  })
})
