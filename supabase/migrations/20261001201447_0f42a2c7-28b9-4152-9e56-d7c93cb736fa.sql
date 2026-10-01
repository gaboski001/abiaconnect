-- lovable-cron-fallback-reviewed: user explicitly requested the existing migration with a 2-minute review cadence; queue covers reports/appeals too
-- =============================================================================
-- Ugo, AbiaConnect's AI Community Guardian: background moderation.
-- New threads, replies, member reports and appeals join a queue; the
-- ugo-moderation-worker edge function (every 2 minutes) reviews them so the
-- community stays safe while admins are away. Ugo only acts on its own when
-- it is very sure; anything uncertain is left for an admin.
-- No data is deleted: hidden posts are marked (threads.is_deleted /
-- replies.is_hidden) and can be restored by an admin.
-- =============================================================================

-- Audit log: what Ugo decided and who acted.
ALTER TABLE public.moderation_log
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS actor text NOT NULL DEFAULT 'pre_check',
  ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS moderation_log_content_hash_idx ON public.moderation_log (content_hash, created_at)
  WHERE content_hash IS NOT NULL;

-- Hidden replies: visible only to their author and admins.
ALTER TABLE public.replies ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
DROP POLICY IF EXISTS "Hidden replies only for author or admins" ON public.replies;
CREATE POLICY "Hidden replies only for author or admins" ON public.replies
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (NOT is_hidden OR user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Ugo's notes on member reports.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS ai_note text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at timestamptz;

-- Work queue (server only).
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('thread', 'reply', 'report', 'appeal')),
  ref_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  attempts integer NOT NULL DEFAULT 0,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  processed_at timestamptz,
  UNIQUE (kind, ref_id)
);
CREATE INDEX IF NOT EXISTS moderation_queue_pending_idx ON public.moderation_queue (status, created_at);
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_queue FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_moderation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.moderation_queue (kind, ref_id)
  VALUES (TG_ARGV[0], NEW.id)
  ON CONFLICT (kind, ref_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enqueue_moderation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ugo_queue_thread ON public.threads;
CREATE TRIGGER ugo_queue_thread AFTER INSERT ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('thread');
DROP TRIGGER IF EXISTS ugo_queue_reply ON public.replies;
CREATE TRIGGER ugo_queue_reply AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('reply');
DROP TRIGGER IF EXISTS ugo_queue_report ON public.reports;
CREATE TRIGGER ugo_queue_report AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('report');
DROP TRIGGER IF EXISTS ugo_queue_appeal ON public.moderation_appeals;
CREATE TRIGGER ugo_queue_appeal AFTER INSERT ON public.moderation_appeals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('appeal');

-- The worker claims a batch atomically (safe if two runs overlap). Items stuck
-- in "processing" for 10 minutes (a crashed run) are picked up again.
CREATE OR REPLACE FUNCTION public.claim_moderation_queue(_limit integer DEFAULT 15)
RETURNS TABLE (id uuid, kind text, ref_id uuid, attempts integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.moderation_queue q
     SET status = 'processing', claimed_at = now(), attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT m.id FROM public.moderation_queue m
      WHERE m.status = 'pending'
         OR (m.status = 'processing' AND m.claimed_at < now() - interval '10 minutes')
      ORDER BY m.created_at
      LIMIT LEAST(GREATEST(_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.id, q.kind, q.ref_id, q.attempts
$$;
REVOKE EXECUTE ON FUNCTION public.claim_moderation_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_moderation_queue(integer) TO service_role;

-- Scheduler token: authenticates scheduled jobs to edge functions without
-- depending on the email system's stored key (which email changes may remove).
DO $$
BEGIN
  IF to_regnamespace('vault') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'abia_cron_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'abia_cron_token',
      'Authenticates scheduled jobs (birthday greetings, Ugo moderation) to edge functions'
    );
  END IF;
  EXECUTE $f$
    CREATE OR REPLACE FUNCTION public.verify_cron_token(_token text)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $b$
      SELECT _token IS NOT NULL AND length(_token) >= 32 AND EXISTS (
        SELECT 1 FROM vault.decrypted_secrets WHERE name = 'abia_cron_token' AND decrypted_secret = _token)
    $b$
  $f$;
  REVOKE EXECUTE ON FUNCTION public.verify_cron_token(text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.verify_cron_token(text) TO service_role;
END $$;

-- Schedules: Ugo every 2 minutes; birthday greetings daily at 07:00 Lagos
-- (re-created here so both use the scheduler token).
DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'ugo-moderation-worker';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'ugo-moderation-worker',
    '*/2 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/ugo-moderation-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-birthday-greetings';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'daily-birthday-greetings',
    '0 6 * * *', -- 06:00 UTC = 07:00 Africa/Lagos
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-birthday-greetings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
END $$;