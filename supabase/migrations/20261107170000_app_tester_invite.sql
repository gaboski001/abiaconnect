-- App tester invitation: a one-time email asking active members to test the
-- Android app.
--
--   - STARTS SWITCHED OFF. Nothing is sent until an admin switches it on in
--     Admin -> Email Settings.
--   - Once per member, active members only (signed in during the last 90 days).
--   - Members who unsubscribed from any other AbiaConnect email are left out.
--   - Every email has an unsubscribe link that works without signing in.
--   - A failed send is tried again later, three times at most.

CREATE TABLE IF NOT EXISTS public.app_tester_invites (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Secret value in the member's unsubscribe link.
  token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  last_sent_at timestamptz,
  attempts     integer NOT NULL DEFAULT 0,
  opted_out_at timestamptz
);
ALTER TABLE public.app_tester_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_tester_invites FROM anon, authenticated;

ALTER TABLE public.member_email_settings DROP CONSTRAINT IF EXISTS member_email_settings_key_check;
ALTER TABLE public.member_email_settings
  ADD CONSTRAINT member_email_settings_key_check CHECK (key IN ('premium_invite', 'support_appeal', 'abia_this_week', 'app_tester_invite'));
INSERT INTO public.member_email_settings (key, enabled) VALUES ('app_tester_invite', false)
ON CONFLICT (key) DO NOTHING;

-- Picks the members to email now and records the send, so a second run does
-- not email them again. Called by the app-tester-invite function only.
CREATE OR REPLACE FUNCTION public.app_tester_invite_claim(_limit integer DEFAULT 100)
RETURNS TABLE (user_id uuid, email text, name text, token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.member_email_enabled('app_tester_invite') THEN RETURN; END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT p.id, p.email AS member_email, COALESCE(NULLIF(p.display_name, ''), p.username) AS member_name
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.app_tester_invites a ON a.user_id = p.id
    WHERE p.email IS NOT NULL AND p.email <> ''
      AND NOT p.is_banned AND NOT p.is_deleted
      AND u.last_sign_in_at >= now() - interval '90 days'
      AND a.opted_out_at IS NULL
      AND a.last_sent_at IS NULL
      AND COALESCE(a.attempts, 0) < 3
      AND NOT EXISTS (SELECT 1 FROM public.abia_this_week_emails x WHERE x.user_id = p.id AND x.opted_out_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.premium_invites x WHERE x.user_id = p.id AND x.opted_out_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.support_appeals x WHERE x.user_id = p.id AND x.opted_out_at IS NOT NULL)
    ORDER BY p.id
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500))
  ), saved AS (
    INSERT INTO public.app_tester_invites AS a (user_id, last_sent_at, attempts)
    SELECT id, now(), 1 FROM picked
    ON CONFLICT ON CONSTRAINT app_tester_invites_pkey DO UPDATE SET last_sent_at = now(), attempts = a.attempts + 1
    RETURNING a.user_id, a.token
  )
  SELECT picked.id, picked.member_email, picked.member_name, saved.token
  FROM picked JOIN saved ON saved.user_id = picked.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.app_tester_invite_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tester_invite_claim(integer) TO service_role;

-- A send failed: pick this member again on a later run.
CREATE OR REPLACE FUNCTION public.app_tester_invite_retry(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.app_tester_invites SET last_sent_at = NULL WHERE user_id = _user_id;
$$;
REVOKE EXECUTE ON FUNCTION public.app_tester_invite_retry(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tester_invite_retry(uuid) TO service_role;

-- The unsubscribe link in the email. True when the link is valid.
CREATE OR REPLACE FUNCTION public.app_tester_invite_opt_out(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  UPDATE public.app_tester_invites SET opted_out_at = COALESCE(opted_out_at, now()) WHERE token = _token;
  v_found := FOUND;
  RETURN v_found;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.app_tester_invite_opt_out(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_tester_invite_opt_out(uuid) TO anon, authenticated;

-- The admin screen: the same as before, plus this email.
CREATE OR REPLACE FUNCTION public.admin_member_email_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'premium_invite', jsonb_build_object(
      'enabled', public.member_email_enabled('premium_invite'),
      'sent_30d', (SELECT count(*) FROM public.premium_invites WHERE last_sent_at >= now() - interval '30 days'),
      'unsubscribed', (SELECT count(*) FROM public.premium_invites WHERE opted_out_at IS NOT NULL)),
    'support_appeal', jsonb_build_object(
      'enabled', public.member_email_enabled('support_appeal'),
      'sent_30d', (SELECT count(*) FROM public.support_appeals WHERE last_sent_at >= now() - interval '30 days'),
      'unsubscribed', (SELECT count(*) FROM public.support_appeals WHERE opted_out_at IS NOT NULL)),
    'abia_this_week', jsonb_build_object(
      'enabled', public.member_email_enabled('abia_this_week'),
      'sent_30d', (SELECT count(*) FROM public.abia_this_week_emails WHERE last_sent_at >= now() - interval '30 days'),
      'unsubscribed', (SELECT count(*) FROM public.abia_this_week_emails WHERE opted_out_at IS NOT NULL)),
    'app_tester_invite', jsonb_build_object(
      'enabled', public.member_email_enabled('app_tester_invite'),
      'sent_30d', (SELECT count(*) FROM public.app_tester_invites WHERE last_sent_at >= now() - interval '30 days'),
      'unsubscribed', (SELECT count(*) FROM public.app_tester_invites WHERE opted_out_at IS NOT NULL))
  );
END;
$$;

-- Every hour, in batches of 100, so everyone is reached without a burst. It
-- picks nobody while the switch is off, or once everyone has been emailed.
DO $do$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'app-tester-invite';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'app-tester-invite',
    '20 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/app-tester-invite',
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
END;
$do$;

NOTIFY pgrst, 'reload schema';
