-- On/off switches for the two member emails (Admin -> Email Settings):
--   premium_invite  - the Premium invitation after a member reaches the daily limit
--   support_appeal  - the "Help keep AbiaConnect running" email every three months
--
-- Both start switched on, as they already are. While one is off its daily job
-- still runs but picks nobody, so no member is skipped for good: they are
-- picked up again once it is switched back on.

CREATE TABLE IF NOT EXISTS public.member_email_settings (
  key        text PRIMARY KEY CHECK (key IN ('premium_invite', 'support_appeal')),
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.member_email_settings (key) VALUES ('premium_invite'), ('support_appeal')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.member_email_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_email_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.member_email_enabled(_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE((SELECT s.enabled FROM public.member_email_settings s WHERE s.key = _key), false) $$;
REVOKE EXECUTE ON FUNCTION public.member_email_enabled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_email_enabled(text) TO service_role;

-- What the admin screen shows: each switch, with how many emails went out in
-- the last 30 days and how many members have unsubscribed.
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
      'unsubscribed', (SELECT count(*) FROM public.support_appeals WHERE opted_out_at IS NOT NULL))
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_member_email_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_member_email_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_member_email(_key text, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501'; END IF;
  IF _enabled IS NULL THEN RAISE EXCEPTION 'Invalid value' USING ERRCODE = '22023'; END IF;
  UPDATE public.member_email_settings SET enabled = _enabled, updated_at = now(), updated_by = auth.uid() WHERE key = _key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown email' USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_member_email(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_member_email(text, boolean) TO authenticated;

-- The two pickers, unchanged except for the switch check on their first line.
CREATE OR REPLACE FUNCTION public.premium_invite_claim(_limit integer DEFAULT 100)
RETURNS TABLE (user_id uuid, email text, name text, token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.member_email_enabled('premium_invite') THEN RETURN; END IF;

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

CREATE OR REPLACE FUNCTION public.support_appeal_claim(_limit integer DEFAULT 150)
RETURNS TABLE (user_id uuid, email text, name text, token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.member_email_enabled('support_appeal') THEN RETURN; END IF;

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