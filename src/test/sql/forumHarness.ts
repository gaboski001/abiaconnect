import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

/**
 * Stand-ins for the Supabase objects the forum engagement + contests migration
 * depends on (auth, roles, profiles, forum tables, subgroups, notifications,
 * admin helpers). The real migration file is applied on top.
 */
const PRELUDE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE SCHEMA extensions;
  CREATE EXTENSION pgcrypto SCHEMA extensions;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.role', true), '') $$;
  GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text, username text, avatar_url text, bio text, lga text,
    created_at timestamptz NOT NULL DEFAULT now(),
    reputation integer NOT NULL DEFAULT 0,
    is_banned boolean NOT NULL DEFAULT false, is_deleted boolean NOT NULL DEFAULT false
  );
  -- Mirrors the live database's existing privileged-fields rule (role, ban
  -- status and reputation are admin-only), which the migration must coexist with.
  CREATE TYPE public.app_role AS ENUM ('Super Admin', 'Admin', 'Member');
  ALTER TABLE public.profiles ADD COLUMN role text NOT NULL DEFAULT 'Member';
  CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role::text) $$;
  CREATE FUNCTION public.prevent_privileged_profile_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
        OR NEW.reputation IS DISTINCT FROM OLD.reputation)
       AND NOT (public.has_role(auth.uid(), 'Admin') OR public.has_role(auth.uid(), 'Super Admin')) THEN
      RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER prevent_privileged_profile_changes BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_changes();
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
  CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());

  CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
    type text NOT NULL, message text, link text, is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.admins (user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = _user_id) $$;

  CREATE TABLE public.subgroups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
    created_by uuid, is_private boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.subgroup_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subgroup_id uuid NOT NULL, user_id uuid NOT NULL
  );
  CREATE FUNCTION public.is_subgroup_member(_subgroup_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE AS
    $$ SELECT EXISTS (SELECT 1 FROM public.subgroup_members WHERE subgroup_id = _subgroup_id AND user_id = _user_id) $$;
  CREATE FUNCTION public.is_subgroup_admin(_subgroup_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE AS
    $$ SELECT public.is_admin(_user_id) OR EXISTS (SELECT 1 FROM public.subgroups s WHERE s.id = _subgroup_id AND s.created_by = _user_id) $$;

  CREATE TABLE public.threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL DEFAULT 't',
    author_id uuid, user_id uuid, is_deleted boolean NOT NULL DEFAULT false,
    view_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, user_id uuid,
    content text NOT NULL DEFAULT 'r', created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.thread_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL, user_id uuid NOT NULL,
    value integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (thread_id, user_id)
  );
  CREATE TABLE public.reply_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reply_id uuid NOT NULL, user_id uuid NOT NULL,
    value integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (reply_id, user_id)
  );
  -- Simplified stand-in for the live per-client rate limiter.
  CREATE TABLE public.client_rate_limits (client_key text, scope text, n integer NOT NULL DEFAULT 0, PRIMARY KEY (client_key, scope));
  CREATE FUNCTION public.enforce_client_rate_limit(_scope text, _max int, _window_seconds int DEFAULT 60)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE c integer;
  BEGIN
    INSERT INTO public.client_rate_limits AS r (client_key, scope, n)
    VALUES (COALESCE(auth.uid()::text, 'anon'), _scope, 1)
    ON CONFLICT (client_key, scope) DO UPDATE SET n = r.n + 1 RETURNING n INTO c;
    IF c > _max THEN RAISE EXCEPTION 'rate_limited'; END IF;
  END $$;

  CREATE TABLE public.poll_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL, poll_option_id uuid NOT NULL,
    user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  );
`

const MIGRATIONS = [
  '20261001200000_forum_points_and_contests.sql',
  '20261001210000_security_review_fixes.sql',
  '20261002100000_restrict_member_stats_badges.sql',
]

export type ForumDb = PGlite & {
  as: (userId: string | null) => Promise<void>
  one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>
  addUser: (opts?: { admin?: boolean; banned?: boolean }) => Promise<string>
  /** Run fn as the signed-in API role, always resetting afterwards. */
  asMember: <T>(userId: string, fn: () => Promise<T>) => Promise<T>
  error: (fn: () => Promise<unknown>) => Promise<string>
}

export async function createForumDb(seed?: (db: ForumDb) => Promise<void>): Promise<ForumDb> {
  const db = (await PGlite.create({ extensions: { pgcrypto } })) as unknown as ForumDb
  await db.exec(PRELUDE)

  db.as = async (userId) => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  }
  db.one = async (sql, params = []) => {
    const res = await db.query(sql, params)
    return res.rows[0] as never
  }
  db.addUser = async ({ admin = false, banned = false } = {}) => {
    const { id } = await db.one<{ id: string }>(`INSERT INTO auth.users VALUES (gen_random_uuid()) RETURNING id`)
    await db.query(`INSERT INTO public.profiles (id, display_name, is_banned) VALUES ($1, 'User', $2)`, [id, banned])
    if (admin) await db.query(`INSERT INTO public.admins VALUES ($1)`, [id])
    return id
  }
  db.asMember = async (userId, fn) => {
    await db.as(userId)
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`)
    await db.query(`SET ROLE authenticated`)
    try {
      return await fn()
    } finally {
      await db.query(`RESET ROLE`)
      await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`)
    }
  }
  db.error = async (fn) => {
    try {
      await fn()
    } catch (e) {
      return (e as Error).message
    }
    return ''
  }

  if (seed) await seed(db)
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations', file), 'utf8'))
  }
  return db
}
