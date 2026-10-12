-- Premium invitation email.
--
-- A free member who runs out of connection requests for the day gets one
-- email the next morning that explains Premium and links to the website's
-- membership page. The Android app cannot show or link to the upgrade page
-- (Google Play rules), so this email is how app members hear about it.
--
--   - At most one email per member every 30 days.
--   - Every email has an unsubscribe link that works without signing in.
--   - Nothing is sent while Premium cannot be bought (no paid plan on sale,
--     or no payment provider switched on).

CREATE TABLE IF NOT EXISTS public.premium_invites (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Secret value in the member's unsubscribe link.
  token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  last_sent_at timestamptz,
  opted_out_at timestamptz
);
ALTER TABLE public.premium_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_invites FROM anon, authenticated;

-- Picks the members to email now and records the send, so a second run on the
-- same day finds nobody. Called by the daily-premium-invite function only.
CREATE OR REPLACE FUNCTION public.premium_invite_claim(_limit integer DEFAULT 100)
RETURNS TABLE (user_id uuid, email text, name text, token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subscription_plans sp WHERE sp.tier <> 'free' AND sp.is_active AND sp.is_visible)
     OR NOT EXISTS (SELECT 1 FROM public.payment_providers pp WHERE pp.is_enabled) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT p.id, p.email AS member_email, COALESCE(NULLIF(p.display_name, ''), p.username) AS member_name
    FROM public.profiles p
    LEFT JOIN public.premium_invites i ON i.user_id = p.id
    WHERE p.email IS NOT NULL AND p.email <> ''
      AND NOT p.is_banned AND NOT p.is_deleted
      AND i.opted_out_at IS NULL
      AND (i.last_sent_at IS NULL OR i.last_sent_at < now() - interval '30 days')
      AND EXISTS (SELECT 1 FROM public.monetization_events e
                  WHERE e.user_id = p.id AND e.event = 'LIKE_LIMIT_REACHED'
                    AND e.created_at >= now() - interval '48 hours')
      AND (public.dating_current_plan(p.id)).tier = 'free'
    ORDER BY p.id
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500))
  ), saved AS (
    INSERT INTO public.premium_invites AS i (user_id, last_sent_at)
    SELECT id, now() FROM picked
    ON CONFLICT ON CONSTRAINT premium_invites_pkey DO UPDATE SET last_sent_at = now()
    RETURNING i.user_id, i.token
  )
  SELECT picked.id, picked.member_email, picked.member_name, saved.token
  FROM picked JOIN saved ON saved.user_id = picked.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.premium_invite_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.premium_invite_claim(integer) TO service_role;

-- The unsubscribe link in the email. True when the link is valid.
CREATE OR REPLACE FUNCTION public.premium_invite_opt_out(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  UPDATE public.premium_invites SET opted_out_at = COALESCE(opted_out_at, now()) WHERE token = _token;
  v_found := FOUND;
  RETURN v_found;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.premium_invite_opt_out(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.premium_invite_opt_out(uuid) TO anon, authenticated;

-- Every day at 08:00 UTC = 09:00 Africa/Lagos (same sign-in as the other
-- scheduled jobs).
DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-premium-invite';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'daily-premium-invite',
    '0 8 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-premium-invite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );
END $$;
