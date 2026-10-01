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
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

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
`

export type Db = PGlite & {
  as: (userId: string | null) => Promise<void>
  one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>
  addUser: (opts?: { dating?: boolean; banned?: boolean; admin?: boolean }) => Promise<string>
}

export async function createMonetizationDb(): Promise<Db> {
  const db = (await PGlite.create()) as unknown as Db
  await db.exec(PRELUDE)
  const migration = readFileSync(
    resolve(__dirname, '../../../supabase/migrations/20261001120000_dating_monetization_phase1.sql'),
    'utf8',
  )
  await db.exec(migration)

  db.as = async (userId) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  }
  db.one = async (sql, params = []) => {
    const res = await db.query(sql, params)
    return res.rows[0] as never
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
