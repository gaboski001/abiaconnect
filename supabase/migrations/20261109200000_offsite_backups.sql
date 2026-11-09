-- Off-site backups to the owner's Cloudflare R2 storage (edge function
-- offsite-backup). Every night it copies new or changed uploaded files; once a
-- week it also saves every table and the member account list (no passwords).
-- Only the backup job can read through these helpers; admins see the log.

CREATE TABLE IF NOT EXISTS public.backup_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  -- Buckets not worth keeping: contest PDFs are deleted after viewing.
  skip_buckets text[] NOT NULL DEFAULT '{contest-prints}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.backup_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  db_snapshot text,          -- folder name in R2, e.g. db/2026-11-09, when tables were saved
  tables_saved integer NOT NULL DEFAULT 0,
  rows_saved bigint NOT NULL DEFAULT 0,
  files_copied integer NOT NULL DEFAULT 0,
  files_left integer,
  error text
);
CREATE INDEX IF NOT EXISTS backup_runs_started_idx ON public.backup_runs (started_at DESC);

-- Which uploaded files are already in R2 (and at which version).
CREATE TABLE IF NOT EXISTS public.backup_file_state (
  bucket_id text NOT NULL,
  name text NOT NULL,
  copied_updated_at timestamptz NOT NULL,
  PRIMARY KEY (bucket_id, name)
);

ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_file_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_settings, public.backup_runs, public.backup_file_state FROM PUBLIC, anon, authenticated;

-- Every ordinary table in the public schema.
CREATE OR REPLACE FUNCTION public.backup_tables()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.relname::text
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
   ORDER BY 1;
$$;

-- One page of a table as JSON rows.
CREATE OR REPLACE FUNCTION public.backup_table_page(_table text, _offset integer, _limit integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.backup_tables() t WHERE t = _table) THEN
    RAISE EXCEPTION 'unknown_table';
  END IF;
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I ORDER BY ctid LIMIT %s OFFSET %s) t',
    _table, LEAST(GREATEST(_limit, 1), 5000), GREATEST(_offset, 0))
  INTO r;
  RETURN r;
END;
$$;

-- Member accounts without passwords, so accounts can be recreated and matched
-- to their profiles if the site ever has to move.
CREATE OR REPLACE FUNCTION public.backup_auth_users(_offset integer, _limit integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
    FROM (SELECT id, email, phone, created_at, last_sign_in_at, email_confirmed_at,
                 raw_user_meta_data, raw_app_meta_data
            FROM auth.users ORDER BY created_at, id
           LIMIT LEAST(GREATEST(_limit, 1), 5000) OFFSET GREATEST(_offset, 0)) u;
$$;

-- Uploaded files that are new or changed since they were last copied.
CREATE OR REPLACE FUNCTION public.backup_files_to_copy(_limit integer DEFAULT 200)
RETURNS TABLE (bucket_id text, name text, updated_at timestamptz, mimetype text, size bigint, waiting bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH todo AS (
    SELECT o.bucket_id::text AS bucket_id, o.name::text AS name, COALESCE(o.updated_at, o.created_at) AS updated_at,
           o.metadata->>'mimetype' AS mimetype, NULLIF(o.metadata->>'size', '')::bigint AS size
      FROM storage.objects o
     WHERE o.name IS NOT NULL
       AND NOT (o.bucket_id = ANY (COALESCE((SELECT s.skip_buckets FROM public.backup_settings s WHERE s.id), '{}'::text[])))
       AND NOT EXISTS (SELECT 1 FROM public.backup_file_state f
                        WHERE f.bucket_id = o.bucket_id AND f.name = o.name
                          AND f.copied_updated_at >= COALESCE(o.updated_at, o.created_at))
  )
  SELECT t.*, count(*) OVER () FROM todo t ORDER BY t.updated_at LIMIT LEAST(GREATEST(_limit, 1), 1000);
$$;

CREATE OR REPLACE FUNCTION public.backup_mark_copied(_bucket text, _name text, _updated_at timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.backup_file_state (bucket_id, name, copied_updated_at) VALUES (_bucket, _name, _updated_at)
  ON CONFLICT (bucket_id, name) DO UPDATE SET copied_updated_at = EXCLUDED.copied_updated_at;
$$;

-- When the last full table snapshot was saved (the job takes one a week).
CREATE OR REPLACE FUNCTION public.backup_last_snapshot()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT max(started_at) FROM public.backup_runs WHERE ok AND db_snapshot IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.backup_tables() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_table_page(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_auth_users(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_files_to_copy(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_mark_copied(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backup_last_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_table_page(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_auth_users(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_files_to_copy(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_mark_copied(text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.backup_last_snapshot() TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.backup_runs, public.backup_settings TO service_role;
GRANT USAGE ON SEQUENCE public.backup_runs_id_seq TO service_role;

-- Admin -> Backups
CREATE OR REPLACE FUNCTION public.admin_backup_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admins_only';
  END IF;
  RETURN jsonb_build_object(
    'enabled', (SELECT enabled FROM public.backup_settings WHERE id),
    'last_snapshot', public.backup_last_snapshot(),
    'files_saved', (SELECT count(*) FROM public.backup_file_state),
    'runs', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC)
        FROM (SELECT started_at, finished_at, ok, db_snapshot, tables_saved, rows_saved, files_copied, files_left, error
                FROM public.backup_runs ORDER BY started_at DESC LIMIT 10) r), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_backup_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_backup_status() TO authenticated;

-- Every night at 01:30 UTC (02:30 in Lagos), when the site is quiet.
DO $do$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'offsite-backup';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'offsite-backup',
    '30 1 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/offsite-backup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    );
    $cron$
  );
END;
$do$;

NOTIFY pgrst, 'reload schema';
