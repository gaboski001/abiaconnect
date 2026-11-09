// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Off-site backup helpers: only the backup job can read through them.
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
  await db.exec(`
    ALTER TABLE auth.users ADD COLUMN email text, ADD COLUMN phone text, ADD COLUMN created_at timestamptz DEFAULT now(),
      ADD COLUMN last_sign_in_at timestamptz, ADD COLUMN email_confirmed_at timestamptz,
      ADD COLUMN raw_user_meta_data jsonb, ADD COLUMN raw_app_meta_data jsonb, ADD COLUMN encrypted_password text;
    CREATE SCHEMA storage;
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, metadata jsonb,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    GRANT USAGE ON SCHEMA storage TO service_role;
  `)
  await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261109200000_offsite_backups.sql'), 'utf8'))
}, 60_000)

const asService = <T>(fn: () => Promise<T>) => db.asRole('service_role', fn)

describe('off-site backups', () => {
  it('pages through every table and never includes passwords', async () => {
    const a = await db.addUser()
    await db.query(`UPDATE auth.users SET email = 'a@x.ng', encrypted_password = 'secret-hash' WHERE id = $1`, [a])
    const tables = await asService(async () => (await db.query<{ t: string }>(`SELECT t FROM public.backup_tables() t`)).rows.map((r) => r.t))
    expect(tables).toContain('profiles')
    expect(tables).toContain('backup_runs')

    const page = await asService(async () => (await db.one<{ p: unknown[] }>(`SELECT public.backup_table_page('profiles', 0, 1000) p`)).p)
    expect(page.length).toBeGreaterThan(0)
    await expect(asService(() => db.query(`SELECT public.backup_table_page('pg_authid', 0)`))).rejects.toThrow(/unknown_table/)

    const users = await asService(async () => (await db.one<{ u: Array<Record<string, unknown>> }>(`SELECT public.backup_auth_users(0) u`)).u)
    const mine = users.find((u) => u.id === a)!
    expect(mine.email).toBe('a@x.ng')
    expect(JSON.stringify(users)).not.toContain('secret-hash')
  })

  it('copies new and changed files only, and skips contest PDFs', async () => {
    await db.query(`
      INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
        ('avatars', 'u1/me.png', '{"mimetype":"image/png","size":"10"}'),
        ('contest-prints', 'u1/print.pdf', '{"mimetype":"application/pdf","size":"5"}')`)
    const todo = async () =>
      asService(async () => (await db.query<{ name: string; waiting: string }>(`SELECT name, waiting FROM public.backup_files_to_copy(50)`)).rows)
    expect((await todo()).map((r) => r.name)).toEqual(['u1/me.png'])

    await asService(() => db.query(`SELECT public.backup_mark_copied('avatars', 'u1/me.png', now())`))
    expect(await todo()).toEqual([])

    await db.query(`UPDATE storage.objects SET updated_at = now() + interval '1 minute' WHERE name = 'u1/me.png'`)
    expect((await todo()).map((r) => r.name)).toEqual(['u1/me.png'])
  })

  it('keeps members and visitors out; admins see the log', async () => {
    const member = await db.addUser()
    const admin = await db.addUser({ admin: true })
    for (const sql of [`SELECT public.backup_tables()`, `SELECT public.backup_auth_users(0)`, `SELECT * FROM public.backup_runs`]) {
      await expect(
        db.asRole('authenticated', async () => {
          await db.as(member)
          return db.query(sql)
        }),
      ).rejects.toThrow(/permission denied/)
    }
    await expect(
      db.asRole('authenticated', async () => {
        await db.as(member)
        return db.query(`SELECT public.admin_backup_status()`)
      }),
    ).rejects.toThrow(/admins_only/)
    const status = await db.asRole('authenticated', async () => {
      await db.as(admin)
      return (await db.one<{ s: { enabled: boolean; runs: unknown[] } }>(`SELECT public.admin_backup_status() s`)).s
    })
    expect(status.enabled).toBe(true)
    expect(status.runs).toEqual([])
  })
})
