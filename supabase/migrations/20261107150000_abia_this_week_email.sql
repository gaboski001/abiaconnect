-- "Abia this week" email: the week's busiest public discussions and the leading LGA.
--
--   - STARTS SWITCHED OFF. Nothing is sent until an admin switches it on in
--     Admin -> Email Settings.
--   - At most one email per member every 6 days, active members only (signed in
--     during the last 90 days).
--   - Every email has an unsubscribe link that works without signing in.
--   - Nothing is sent in a quiet week (fewer than 3 discussions to show).
--   - Anonymous posts and private groups are never included.

CREATE TABLE IF NOT EXISTS public.abia_this_week_emails (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Secret value in the member's unsubscribe link.
  token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  last_sent_at timestamptz,
  opted_out_at timestamptz
);
ALTER TABLE public.abia_this_week_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.abia_this_week_emails FROM anon, authenticated;

ALTER TABLE public.member_email_settings DROP CONSTRAINT IF EXISTS member_email_settings_key_check;
ALTER TABLE public.member_email_settings
  ADD CONSTRAINT member_email_settings_key_check CHECK (key IN ('premium_invite', 'support_appeal', 'abia_this_week'));
INSERT INTO public.member_email_settings (key, enabled) VALUES ('abia_this_week', false)
ON CONFLICT (key) DO NOTHING;

-- The week's busiest public discussions.
CREATE OR REPLACE FUNCTION public.abia_this_week_posts(_limit integer DEFAULT 5)
RETURNS TABLE (id uuid, title text, replies bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.title,
         (SELECT count(*) FROM public.replies r WHERE r.thread_id = t.id AND NOT r.is_hidden) AS replies
    FROM public.threads t
   WHERE NOT t.is_deleted
     AND NOT t.is_anonymous
     AND t.created_at >= now() - interval '7 days'
     AND (t.subgroup_id IS NULL OR public.is_public_subgroup(t.subgroup_id))
   ORDER BY replies DESC, t.upvotes DESC, t.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(_limit, 5), 10));
$$;
REVOKE EXECUTE ON FUNCTION public.abia_this_week_posts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abia_this_week_posts(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.lga_of_the_month() TO service_role;

-- Picks the members to email now and records the send, so a second run does
-- not email them again. Called by the abia-this-week function only.
CREATE OR REPLACE FUNCTION public.abia_this_week_claim(_limit integer DEFAULT 150)
RETURNS TABLE (user_id uuid, email text, name text, token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.member_email_enabled('abia_this_week') THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.abia_this_week_posts(3)) < 3 THEN RETURN; END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT p.id, p.email AS member_email, COALESCE(NULLIF(p.display_name, ''), p.username) AS member_name
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.abia_this_week_emails a ON a.user_id = p.id
    WHERE p.email IS NOT NULL AND p.email <> ''
      AND NOT p.is_banned AND NOT p.is_deleted
      AND u.last_sign_in_at >= now() - interval '90 days'
      AND a.opted_out_at IS NULL
      AND (a.last_sent_at IS NULL OR a.last_sent_at < now() - interval '6 days')
    ORDER BY a.last_sent_at NULLS FIRST, p.id
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 150), 500))
  ), saved AS (
    INSERT INTO public.abia_this_week_emails AS a (user_id, last_sent_at)
    SELECT id, now() FROM picked
    ON CONFLICT ON CONSTRAINT abia_this_week_emails_pkey DO UPDATE SET last_sent_at = now()
    RETURNING a.user_id, a.token
  )
  SELECT picked.id, picked.member_email, picked.member_name, saved.token
  FROM picked JOIN saved ON saved.user_id = picked.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.abia_this_week_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abia_this_week_claim(integer) TO service_role;

-- The unsubscribe link in the email. True when the link is valid.
CREATE OR REPLACE FUNCTION public.abia_this_week_opt_out(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  UPDATE public.abia_this_week_emails SET opted_out_at = COALESCE(opted_out_at, now()) WHERE token = _token;
  v_found := FOUND;
  RETURN v_found;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.abia_this_week_opt_out(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abia_this_week_opt_out(uuid) TO anon, authenticated;

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
      'unsubscribed', (SELECT count(*) FROM public.abia_this_week_emails WHERE opted_out_at IS NOT NULL))
  );
END;
$$;

-- Mondays to Fridays at 07:00 UTC = 08:00 Africa/Lagos, in batches, so everyone
-- is reached within the week. It picks nobody while the switch is off.
DO $do$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'abia-this-week';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'abia-this-week',
    '0 7 * * 1-5',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/abia-this-week',
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
