-- lovable-cron-fallback-reviewed: user explicitly requested the existing migration with a 30-minute popular-thread cadence
-- Facebook sharing: admin approval + popular threads (replaces "post everything").
--
-- Before: every new non-anonymous thread was posted to the Facebook Page the
-- moment it was created: no approval, threads in private groups included, and
-- posts stayed on Facebook even after the thread was removed.
--
-- Now a thread reaches Facebook only when:
--   1. an admin presses "Share to Facebook" on it, or
--   2. it becomes popular (10+ upvotes or 10+ visible replies within 7 days),
--      Ugo reviewed it and found nothing wrong, and nobody has an open report
--      on it. At most 3 popular threads per 24 hours.
-- Never shared, whoever asks: anonymous threads, threads in private or
-- inactive groups, removed threads.
-- If a shared thread is later removed (or deleted), its Facebook post is deleted too.
--
-- The Facebook function posts only threads queued here, and re-checks them.

-- Stop the old automatic posting.
DROP TRIGGER IF EXISTS trg_notify_facebook_on_new_thread ON public.threads;
DROP FUNCTION IF EXISTS public.notify_facebook_on_new_thread();

CREATE TABLE IF NOT EXISTS public.facebook_shares (
  thread_id uuid PRIMARY KEY REFERENCES public.threads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'posting', 'posted', 'failed', 'skipped', 'removing', 'removed')),
  source text NOT NULL CHECK (source IN ('admin', 'popular')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fb_post_id text,
  note text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz
);
CREATE INDEX IF NOT EXISTS facebook_shares_source_created_idx ON public.facebook_shares (source, created_at);
ALTER TABLE public.facebook_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.facebook_shares FROM anon, authenticated;
GRANT SELECT ON public.facebook_shares TO authenticated;
GRANT ALL ON public.facebook_shares TO service_role;
DROP POLICY IF EXISTS "Admins see Facebook shares" ON public.facebook_shares;
CREATE POLICY "Admins see Facebook shares" ON public.facebook_shares
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Why a thread may not go to Facebook (NULL = it may).
CREATE OR REPLACE FUNCTION public.facebook_share_blocker(_thread_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN t.id IS NULL THEN 'thread not found'
    WHEN t.is_deleted THEN 'this thread was removed'
    WHEN t.is_anonymous THEN 'anonymous threads are never shared'
    WHEN s.id IS NOT NULL AND (s.is_private OR NOT s.is_active) THEN 'threads in private groups are never shared'
    ELSE NULL
  END
  FROM (SELECT _thread_id AS id) x
  LEFT JOIN public.threads t ON t.id = x.id
  LEFT JOIN public.subgroups s ON s.id = t.subgroup_id
$$;
REVOKE EXECUTE ON FUNCTION public.facebook_share_blocker(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.facebook_share_blocker(uuid) TO service_role;

-- Ask the Facebook function to post or remove (same sign-in as the cron jobs:
-- public app key for the gateway, Vault scheduler token for the function).
CREATE OR REPLACE FUNCTION public.dispatch_facebook_share(_thread_id uuid, _action text DEFAULT 'post', _fb_post_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'abia_cron_token';
  IF v_token IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/post-thread-to-facebook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
      'x-cron-token', v_token
    ),
    body := jsonb_strip_nulls(jsonb_build_object('thread_id', _thread_id, 'action', _action, 'fb_post_id', _fb_post_id))
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dispatch_facebook_share(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Admin "Share to Facebook" button.
CREATE OR REPLACE FUNCTION public.share_thread_to_facebook(_thread_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block text;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can share to Facebook' USING ERRCODE = '42501';
  END IF;
  v_block := public.facebook_share_blocker(_thread_id);
  IF v_block IS NOT NULL THEN
    RAISE EXCEPTION '%', v_block USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_status FROM public.facebook_shares WHERE thread_id = _thread_id;
  IF v_status IN ('queued', 'posting', 'posted', 'removing') THEN
    RETURN v_status; -- never post the same thread twice
  END IF;

  INSERT INTO public.facebook_shares (thread_id, status, source, requested_by)
  VALUES (_thread_id, 'queued', 'admin', auth.uid())
  ON CONFLICT (thread_id) DO UPDATE
    SET status = 'queued', source = 'admin', requested_by = auth.uid(), note = NULL, updated_at = now();
  PERFORM public.dispatch_facebook_share(_thread_id, 'post');
  RETURN 'queued';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.share_thread_to_facebook(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_thread_to_facebook(uuid) TO authenticated;

-- Popular threads (run by the scheduler every 30 minutes).
CREATE OR REPLACE FUNCTION public.queue_popular_threads_for_facebook(
  _min_upvotes integer DEFAULT 10,
  _min_replies integer DEFAULT 10,
  _daily_cap integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room integer;
  v_id uuid;
  v_n integer := 0;
BEGIN
  SELECT _daily_cap - count(*) INTO v_room
    FROM public.facebook_shares
   WHERE source = 'popular' AND created_at > now() - interval '24 hours';
  IF v_room <= 0 THEN RETURN 0; END IF;

  FOR v_id IN
    SELECT t.id
      FROM public.threads t
     WHERE t.created_at > now() - interval '7 days'
       AND public.facebook_share_blocker(t.id) IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.facebook_shares f WHERE f.thread_id = t.id)
       -- Ugo has reviewed it and found nothing wrong.
       AND EXISTS (
         SELECT 1 FROM public.moderation_queue q
          WHERE q.kind = 'thread' AND q.ref_id = t.id AND q.status = 'done'
            AND q.outcome IN ('ok', 'skipped: already checked', 'skipped: admin')
       )
       AND NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.thread_id = t.id AND r.status = 'pending')
       AND (
         t.upvotes >= _min_upvotes
         OR (SELECT count(*) FROM public.replies rp WHERE rp.thread_id = t.id AND NOT rp.is_hidden) >= _min_replies
       )
     ORDER BY t.upvotes DESC, t.created_at
     LIMIT v_room
  LOOP
    INSERT INTO public.facebook_shares (thread_id, status, source) VALUES (v_id, 'queued', 'popular')
    ON CONFLICT (thread_id) DO NOTHING;
    PERFORM public.dispatch_facebook_share(v_id, 'post');
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_popular_threads_for_facebook(integer, integer, integer) FROM PUBLIC, anon, authenticated;

-- Removed thread: take its Facebook post down too.
CREATE OR REPLACE FUNCTION public.facebook_unshare_removed_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_post text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status, fb_post_id INTO v_status, v_post FROM public.facebook_shares WHERE thread_id = OLD.id;
    IF v_status = 'posted' AND v_post IS NOT NULL THEN
      PERFORM public.dispatch_facebook_share(OLD.id, 'remove', v_post);
    END IF;
    RETURN OLD;
  END IF;

  IF (NEW.is_deleted AND NOT OLD.is_deleted) OR NEW.subgroup_id IS DISTINCT FROM OLD.subgroup_id THEN
    IF public.facebook_share_blocker(NEW.id) IS NOT NULL THEN
      UPDATE public.facebook_shares
         SET status = CASE WHEN status = 'posted' THEN 'removing' ELSE 'skipped' END,
             note = public.facebook_share_blocker(NEW.id),
             updated_at = now()
       WHERE thread_id = NEW.id AND status IN ('queued', 'posted')
      RETURNING status INTO v_status;
      IF v_status = 'removing' THEN
        PERFORM public.dispatch_facebook_share(NEW.id, 'remove');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.facebook_unshare_removed_thread() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS facebook_unshare_removed_thread ON public.threads;
CREATE TRIGGER facebook_unshare_removed_thread AFTER UPDATE OF is_deleted, subgroup_id ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.facebook_unshare_removed_thread();
DROP TRIGGER IF EXISTS facebook_unshare_deleted_thread ON public.threads;
CREATE TRIGGER facebook_unshare_deleted_thread BEFORE DELETE ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.facebook_unshare_removed_thread();

DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'facebook-popular-threads';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule('facebook-popular-threads', '*/30 * * * *', 'SELECT public.queue_popular_threads_for_facebook()');
END $$;