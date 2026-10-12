-- Support appeal email.
--
-- Active members get a short "Help keep AbiaConnect running" email with a
-- link to the Donate page on the website. The Android app cannot show or link
-- to the Donate page (Google Play rules), so this email is how app members
-- hear about it.
--
--   - At most one email per member every 90 days.
--   - Active means: signed in during the last 90 days, and a member for at
--     least 14 days.
--   - Members who gave in the last 90 days are left out.
--   - Every email has an unsubscribe link that works without signing in.
--   - Nothing is sent while there is no way to give (no payment provider
--     switched on and no donation account shown on the Donate page).
--   - Sent in batches, so the first round reaches all members over a few days.

CREATE TABLE IF NOT EXISTS public.support_appeals (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Secret value in the member's unsubscribe link.
  token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  last_sent_at timestamptz,
  opted_out_at timestamptz
);
ALTER TABLE public.support_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_appeals FROM anon, authenticated;

-- Picks the members to email now and records the send, so a second run on the
-- same day does not email them again. Called by daily-support-appeal only.
CREATE OR REPLACE FUNCTION public.support_appeal_claim(_limit integer DEFAULT 150)
RETURNS TABLE (user_id uuid, email text, name text, token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.payment_providers pp WHERE pp.is_enabled)
     AND NOT EXISTS (SELECT 1 FROM public.donation_accounts da WHERE da.is_active) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT p.id, p.email AS member_email, COALESCE(NULLIF(p.display_name, ''), p.username) AS member_name
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.support_appeals a ON a.user_id = p.id
    WHERE p.email IS NOT NULL AND p.email <> ''
      AND NOT p.is_banned AND NOT p.is_deleted
      AND u.last_sign_in_at >= now() - interval '90 days'
      AND u.created_at < now() - interval '14 days'
      AND a.opted_out_at IS NULL
      AND (a.last_sent_at IS NULL OR a.last_sent_at < now() - interval '90 days')
      AND NOT EXISTS (SELECT 1 FROM public.donations d
                      WHERE d.status = 'confirmed' AND d.created_at >= now() - interval '90 days'
                        AND (d.created_by = p.id OR lower(d.donor_email) = lower(p.email)))
    ORDER BY a.last_sent_at NULLS FIRST, p.id
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 150), 500))
  ), saved AS (
    INSERT INTO public.support_appeals AS a (user_id, last_sent_at)
    SELECT id, now() FROM picked
    ON CONFLICT ON CONSTRAINT support_appeals_pkey DO UPDATE SET last_sent_at = now()
    RETURNING a.user_id, a.token
  )
  SELECT picked.id, picked.member_email, picked.member_name, saved.token
  FROM picked JOIN saved ON saved.user_id = picked.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.support_appeal_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_appeal_claim(integer) TO service_role;

-- The unsubscribe link in the email. True when the link is valid.
CREATE OR REPLACE FUNCTION public.support_appeal_opt_out(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  UPDATE public.support_appeals SET opted_out_at = COALESCE(opted_out_at, now()) WHERE token = _token;
  v_found := FOUND;
  RETURN v_found;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.support_appeal_opt_out(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_appeal_opt_out(uuid) TO anon, authenticated;

-- Every day at 09:00 UTC = 10:00 Africa/Lagos (same sign-in as the other
-- scheduled jobs).
DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-support-appeal';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'daily-support-appeal',
    '0 9 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-support-appeal',
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
