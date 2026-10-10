-- Newsdesk bot: keep the admin's "Recent posts" list short.
--
--   - log_keep_days: finished posts (published, approved or rejected) leave
--     the list in Admin -> Newsdesk Bot after this many days. The admin
--     chooses 1, 3, 7, 14 or 30 days.
--   - log_cleared_at: set by the "Clear the list now" button; everything
--     finished before that moment leaves the list at once.
--   - A nightly job erases the records for good after 45 days. Until then the
--     bot still needs them, hidden, so it does not post the same story twice
--     and so link previews keep their banner. The forum threads themselves
--     are never touched.

ALTER TABLE public.newsdesk_settings
  ADD COLUMN IF NOT EXISTS log_keep_days integer NOT NULL DEFAULT 7 CHECK (log_keep_days BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS log_cleared_at timestamptz;

CREATE OR REPLACE FUNCTION public.newsdesk_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_posts integer;
BEGIN
  DELETE FROM public.newsdesk_posts
   WHERE status IN ('published', 'rejected')
     AND created_at < now() - interval '45 days';
  GET DIAGNOSTICS v_posts = ROW_COUNT;
  DELETE FROM public.newsdesk_runs WHERE started_at < now() - interval '45 days';
  RETURN v_posts;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.newsdesk_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsdesk_cleanup() TO service_role;

-- Every night at 03:20 Lagos time.
DO $do$
DECLARE
  v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'newsdesk-cleanup';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule('newsdesk-cleanup', '20 2 * * *', $cron$SELECT public.newsdesk_cleanup()$cron$);
END;
$do$;