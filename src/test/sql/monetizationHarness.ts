import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * Minimal stand-ins for the Supabase objects the monetization migration
 * depends on (auth schema, roles, profiles, relationship tables,
 * notifications, admin + rate-limit helpers). The real migration file is
 * then applied on top, so the tests exercise the actual SQL.
 */
const PRELUDE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  -- Supabase defaults: API roles can use public, and new tables/functions are
  -- granted to them (RLS and explicit REVOKEs then restrict access).
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text, display_name text, username text, avatar_url text,
    is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.relationship_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    headline text, dob date, lga text, photos text[] NOT NULL DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true
  );
  CREATE TABLE public.relationship_blocks (
    user_id uuid NOT NULL, blocked_id uuid NOT NULL, PRIMARY KEY (user_id, blocked_id)
  );
  CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
    type text NOT NULL, message text, link text, is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;
  CREATE FUNCTION public.enforce_client_rate_limit(_scope text, _max int, _window_seconds int DEFAULT 60)
    RETURNS void LANGUAGE sql AS $$ SELECT $$;

  -- Supabase Vault stand-in (same function signatures; no encryption here).
  CREATE SCHEMA vault;
  CREATE TABLE vault.secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE, description text, secret text NOT NULL);
  CREATE VIEW vault.decrypted_secrets AS SELECT id, name, description, secret AS decrypted_secret FROM vault.secrets;
  CREATE FUNCTION vault.create_secret(new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT '')
    RETURNS uuid LANGUAGE sql AS
    $$ INSERT INTO vault.secrets (secret, name, description) VALUES (new_secret, new_name, new_description) RETURNING id $$;
  CREATE FUNCTION vault.update_secret(secret_id uuid, new_secret text DEFAULT NULL, new_name text DEFAULT NULL, new_description text DEFAULT NULL)
    RETURNS void LANGUAGE sql AS
    $$ UPDATE vault.secrets SET secret = COALESCE(new_secret, secret), name = COALESCE(new_name, name) WHERE id = secret_id $$;
  REVOKE ALL ON SCHEMA vault FROM PUBLIC;
`

const MIGRATIONS = [
  '20261001120000_dating_monetization_phase1.sql',
  '20261001140000_payment_secrets_in_vault.sql',
]

export type Db = PGlite & {
  as: (userId: string | null) => Promise<void>
  one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>
  addUser: (opts?: { dating?: boolean; banned?: boolean; admin?: boolean }) => Promise<string>
  /** Run fn as a database role (e.g. 'authenticated'), always resetting afterwards. */
  asRole: <T>(role: 'anon' | 'authenticated', fn: () => Promise<T>) => Promise<T>
}

export async function createMonetizationDb(): Promise<Db> {
  const db = (await PGlite.create()) as unknown as Db
  await db.exec(PRELUDE)
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations', file), 'utf8'))
  }

  db.as = async (userId) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  }
  db.one = async (sql, params = []) => {
    const res = await db.query(sql, params)
    return res.rows[0] as never
  }
  db.asRole = async (role, fn) => {
    await db.query(`SET ROLE ${role}`)
    try {
      return await fn()
    } finally {
      await db.query(`RESET ROLE`)
    }
  }
  db.addUser = async ({ dating = true, banned = false, admin = false } = {}) => {
    const { id } = await db.one<{ id: string }>(`INSERT INTO auth.users VALUES (gen_random_uuid()) RETURNING id`)
    await db.query(`INSERT INTO public.profiles (id, display_name, is_banned) VALUES ($1, 'User', $2)`, [id, banned])
    if (dating) await db.query(`INSERT INTO public.relationship_profiles (user_id, headline) VALUES ($1, 'Hi')`, [id])
    if (admin) await db.query(`INSERT INTO public.admins VALUES ($1)`, [id])
    return id
  }
  return db
}
