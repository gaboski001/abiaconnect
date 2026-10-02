-- Security: release uploads, push alerts, moderation records, abusable endpoints.
-- (The storage.buckets UPDATE from the original file was applied via the
--  storage tool: app-releases is private with a 100 MB limit.)

-- ---------------------------------------------------------------------------
-- 1. Keyed rate limiter (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _key text,
  _scope text,
  _max integer,
  _window_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_window timestamptz;
  v_count integer;
BEGIN
  IF _key IS NULL OR length(_key) = 0 OR length(_key) > 200
     OR _scope IS NULL OR length(_scope) = 0 OR length(_scope) > 100
     OR _max < 1 OR _window_seconds < 1 OR _window_seconds > 86400 THEN
    RETURN false;
  END IF;
  -- Prefix keeps these apart from the browser-side limiter's keys.
  v_key := 'fn:' || _key;
  v_window := to_timestamp(
    (floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds)::double precision
  );

  DELETE FROM public.client_rate_limits
   WHERE client_key = v_key AND window_start < now() - interval '1 day';

  INSERT INTO public.client_rate_limits AS r (client_key, scope, window_start, count)
  VALUES (v_key, _scope, v_window, 1)
  ON CONFLICT (client_key, scope, window_start)
  DO UPDATE SET count = r.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= _max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. App release uploads: server-side only, with limits on the bucket
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_releases
  ADD COLUMN IF NOT EXISTS file_sha256 text,
  ADD COLUMN IF NOT EXISTS uploaded_via text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Browser uploads/overwrites are no longer allowed; the upload-release function
-- (service role) validates and stores every file. Admins keep read and delete.
DROP POLICY IF EXISTS "admins upload app-releases" ON storage.objects;
DROP POLICY IF EXISTS "admins update app-releases" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3. Moderation history: server-written, review-only for admins
-- ---------------------------------------------------------------------------
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.moderation_log FROM anon, authenticated;
REVOKE UPDATE ON public.moderation_log FROM anon, authenticated;
REVOKE SELECT ON public.moderation_log FROM anon;
-- Admins may only record their review, never rewrite what was decided.
GRANT UPDATE (reviewed_by, reviewed_at, review_note, overridden) ON public.moderation_log TO authenticated;

DROP POLICY IF EXISTS "Only the server writes moderation records" ON public.moderation_log;
CREATE POLICY "Only the server writes moderation records" ON public.moderation_log
  AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "Moderation records cannot be deleted by clients" ON public.moderation_log;
CREATE POLICY "Moderation records cannot be deleted by clients" ON public.moderation_log
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- The reviewer is always the signed-in admin making the change.
CREATE OR REPLACE FUNCTION public.stamp_moderation_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS stamp_moderation_review ON public.moderation_log;
CREATE TRIGGER stamp_moderation_review BEFORE UPDATE ON public.moderation_log
  FOR EACH ROW EXECUTE FUNCTION public.stamp_moderation_review();

-- ---------------------------------------------------------------------------
-- 4. Appeals and reports from members start unreviewed
-- ---------------------------------------------------------------------------
-- Appeals: the app files them through submit_moderation_appeal() (rate
-- limited, fills only the member's own fields). Direct inserts let a member
-- create an appeal that was already "approved" by a named admin.
DROP POLICY IF EXISTS "Users can submit their own appeals" ON public.moderation_appeals;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.moderation_appeals FROM anon;
REVOKE INSERT, DELETE, TRUNCATE ON public.moderation_appeals FROM authenticated;

-- Reports: members report as themselves, unreviewed, and cannot pose as Ugo.
DROP POLICY IF EXISTS "Users create reports" ON public.reports;
CREATE POLICY "Users create reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'pending'
    AND ai_note IS NULL
    AND ai_reviewed_at IS NULL
    AND (thread_id IS NOT NULL OR reply_id IS NOT NULL OR reported_user_id IS NOT NULL)
    AND char_length(coalesce(reason, '')) <= 1000
    AND coalesce(reason, '') !~* '^\s*ugo\s*:'
  );
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.reports FROM anon;

-- Each report starts an AI review, so cap how many one member can file.
CREATE OR REPLACE FUNCTION public.limit_member_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    PERFORM public.enforce_rate_limit('report', 20, 3600);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.limit_member_reports() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS limit_member_reports ON public.reports;
CREATE TRIGGER limit_member_reports BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.limit_member_reports();