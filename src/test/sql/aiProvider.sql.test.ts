// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

/** Stand-ins for Supabase roles, auth, Vault, cron and the admin helper. */
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  CREATE SCHEMA cron;
  CREATE FUNCTION cron.schedule(a text, b text, c text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
  CREATE FUNCTION cron.unschedule(a text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'no such job'; END $$;
  CREATE SCHEMA vault;
  CREATE TABLE vault.secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), secret text, name text, description text);
  CREATE VIEW vault.decrypted_secrets AS SELECT id, name, secret AS decrypted_secret FROM vault.secrets;
  CREATE FUNCTION vault.create_secret(s text, n text, d text) RETURNS uuid LANGUAGE sql AS
    $$ INSERT INTO vault.secrets (secret, name, description) VALUES (s, n, d) RETURNING id $$;
  CREATE FUNCTION vault.update_secret(i uuid, s text, n text, d text) RETURNS void LANGUAGE sql AS
    $$ UPDATE vault.secrets SET secret = s WHERE id = i $$;
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _u) $$;
`
const MIGRATION = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261019150000_ai_provider.sql'), 'utf8')
const ADMIN = '00000000-0000-0000-0000-00000000000a'
const MEMBER = '00000000-0000-0000-0000-00000000000b'
const KEY = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

async function makeDb() {
  const pg = new PGlite()
  await pg.exec(PRELUDE)
  await pg.exec(MIGRATION)
  await pg.query(`INSERT INTO admins VALUES ($1)`, [ADMIN])
  const as = async <T>(role: 'anon' | 'authenticated' | 'service_role', uid: string | null, fn: () => Promise<T>) => {
    await pg.exec(`SET request.jwt.claim.sub = '${uid ?? ''}'; SET ROLE ${role};`)
    try {
      return await fn()
    } finally {
      await pg.exec(`RESET ROLE; RESET request.jwt.claim.sub;`)
    }
  }
  const q = async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows
  return { pg, as, q }
}

describe('AI provider settings', () => {
  let db: Awaited<ReturnType<typeof makeDb>>
  beforeEach(async () => {
    db = await makeDb()
  })

  it('is safe to run twice and starts on Lovable AI with the backup on', async () => {
    await db.pg.exec(MIGRATION)
    const rows = await db.q<{ provider: string; fallback: boolean }>(`SELECT provider, fallback FROM ai_provider_settings`)
    expect(rows).toEqual([{ provider: 'lovable', fallback: true }])
  })

  it('stores a key encrypted, shows admins only a preview, and gives the full key only to the server', async () => {
    const preview = await db.as('authenticated', ADMIN, () => db.q<{ p: string }>(`SELECT admin_set_ai_key('claude', $1) AS p`, [KEY]))
    expect(preview[0]!.p).toBe('sk-ant…6789')
    const seen = await db.as('authenticated', ADMIN, () => db.q<{ preview: string }>(`SELECT * FROM ai_provider_keys`))
    expect(JSON.stringify(seen)).not.toContain(KEY)
    await expect(db.as('authenticated', ADMIN, () => db.q(`SELECT get_ai_config()`))).rejects.toThrow(/permission denied/)
    const config = await db.as('service_role', null, () => db.q<{ c: { keys: { claude: string } } }>(`SELECT get_ai_config() AS c`))
    expect(config[0]!.c.keys.claude).toBe(KEY)
  })

  it('refuses members and visitors', async () => {
    await expect(db.as('authenticated', MEMBER, () => db.q(`SELECT admin_set_ai_key('claude', $1)`, [KEY]))).rejects.toThrow(/Forbidden/)
    await expect(db.as('anon', null, () => db.q(`SELECT admin_set_ai_settings('claude', '{}', true)`))).rejects.toThrow()
    expect(await db.as('authenticated', MEMBER, () => db.q(`SELECT * FROM ai_provider_settings`))).toHaveLength(0)
    await expect(db.as('authenticated', MEMBER, () => db.q(`SELECT admin_ai_usage(7)`))).rejects.toThrow(/Forbidden/)
  })

  it('only switches to a provider whose key is saved, and goes back to Lovable AI when the key is removed', async () => {
    await expect(
      db.as('authenticated', ADMIN, () => db.q(`SELECT admin_set_ai_settings('gemini', '{}', true)`)),
    ).rejects.toThrow(/Save the Gemini API key first/)
    await db.as('authenticated', ADMIN, async () => {
      await db.q(`SELECT admin_set_ai_key('gemini', $1)`, ['AIzaSyA-0123456789abcdefghijklmnopqrs'])
      await db.q(`SELECT admin_set_ai_settings('gemini', '{"gemini":"gemini-2.5-pro"}', false)`)
    })
    expect((await db.q<{ provider: string }>(`SELECT provider FROM ai_provider_settings`))[0]!.provider).toBe('gemini')
    await db.as('authenticated', ADMIN, () => db.q(`SELECT admin_clear_ai_key('gemini')`))
    expect((await db.q<{ provider: string }>(`SELECT provider FROM ai_provider_settings`))[0]!.provider).toBe('lovable')
    expect(await db.q(`SELECT * FROM vault.secrets`)).toHaveLength(0)
  })

  it('rejects things that are not API keys', async () => {
    await expect(
      db.as('authenticated', ADMIN, () => db.q(`SELECT admin_set_ai_key('claude', 'short')`)),
    ).rejects.toThrow(/valid API key/)
  })

  it('counts AI use per feature and provider for admins', async () => {
    await db.as('service_role', null, () =>
      db.q(`INSERT INTO ai_usage_log (feature, provider, ok, fell_back) VALUES
            ('moderation', 'claude', true, false), ('moderation', 'claude', false, false), ('newsdesk', 'lovable', true, true)`),
    )
    const rows = await db.as('authenticated', ADMIN, () =>
      db.q<{ feature: string; provider: string; calls: number; failed: number }>(`SELECT * FROM admin_ai_usage(7)`),
    )
    expect(rows.find((r) => r.feature === 'moderation')).toMatchObject({ provider: 'claude', calls: 2, failed: 1 })
  })
})
