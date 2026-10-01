-- Relationship messaging rules
--   * Free users can only start a chat in the Relationship area with people
--     they have MATCHED with (both liked each other). Two free users who
--     match can always chat.
--   * Plans with the "message_without_match" entitlement (Premium/VIP) can
--     message any member from the Relationship area.
--   * Optional, admin-controlled: apply the same rule to ALL new private
--     conversations (forum included). Off by default so forum messaging is
--     not changed unless an admin chooses to.
-- Existing conversations are never affected.

-- 1. Entitlement on the seeded plans (admins can change it per plan).
UPDATE public.subscription_plans
   SET limits = limits || jsonb_build_object('message_without_match', tier <> 'free')
 WHERE NOT (limits ? 'message_without_match');

-- 2. Admin settings for the Relationship area.
CREATE TABLE IF NOT EXISTS public.dating_settings (
  key        text PRIMARY KEY CHECK (key IN ('restrict_all_new_conversations_to_matches')),
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dating_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage dating settings" ON public.dating_settings;
CREATE POLICY "Admins manage dating settings"
  ON public.dating_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.dating_settings (key, value)
VALUES ('restrict_all_new_conversations_to_matches', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Audit setting changes like other monetization config.
CREATE OR REPLACE FUNCTION public.dating_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  INSERT INTO public.monetization_audit_log (actor_id, action, target, old_value, new_value)
  VALUES (auth.uid(), 'dating_settings.' || lower(TG_OP), NEW.key,
          CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS dating_settings_audit ON public.dating_settings;
CREATE TRIGGER dating_settings_audit
  BEFORE INSERT OR UPDATE ON public.dating_settings
  FOR EACH ROW EXECUTE FUNCTION public.dating_settings_audit();

-- 3. Rule helpers.
CREATE OR REPLACE FUNCTION public.dating_is_match(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dating_matches
    WHERE user_low = LEAST(_a, _b) AND user_high = GREATEST(_a, _b)
  )
$$;

CREATE OR REPLACE FUNCTION public.dating_conversation_between(_a uuid, _b uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.conversations
  WHERE (user1_id = _a AND user2_id = _b) OR (user1_id = _b AND user2_id = _a)
  ORDER BY created_at
  LIMIT 1
$$;

-- 4. Start (or reopen) a chat from the Relationship area.
CREATE OR REPLACE FUNCTION public.dating_start_conversation(_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_new uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF _target IS NULL OR _target = v_uid THEN RAISE EXCEPTION 'Invalid member' USING ERRCODE = '22023'; END IF;
  PERFORM public.enforce_client_rate_limit('dating_start_conversation', 30, 60);

  IF NOT public.dating_user_in_good_standing(v_uid) THEN
    RETURN jsonb_build_object('status', 'account_restricted');
  END IF;
  IF NOT public.dating_user_in_good_standing(_target) OR public.dating_is_blocked(v_uid, _target) THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;

  -- An existing chat can always be reopened.
  v_existing := public.dating_conversation_between(v_uid, _target);
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'conversation_id', v_existing, 'created', false);
  END IF;

  IF NOT (public.dating_is_match(v_uid, _target) OR public.dating_has_entitlement(v_uid, 'message_without_match')) THEN
    PERFORM public.log_monetization_event(v_uid, 'MESSAGE_PAYWALL', '{}'::jsonb);
    RETURN jsonb_build_object('status', 'match_required');
  END IF;

  INSERT INTO public.conversations (user1_id, user2_id)
  VALUES (LEAST(v_uid, _target), GREATEST(v_uid, _target))
  RETURNING id INTO v_new;
  PERFORM public.log_monetization_event(v_uid, 'MESSAGE_STARTED',
    jsonb_build_object('matched', public.dating_is_match(v_uid, _target)));
  RETURN jsonb_build_object('status', 'ok', 'conversation_id', v_new, 'created', true);
END;
$$;

-- 5. Optional site-wide rule, enforced on every new conversation insert.
CREATE OR REPLACE FUNCTION public.enforce_conversation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_other uuid;
BEGIN
  -- Server/service-role inserts and admins are not restricted.
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN RETURN NEW; END IF;
  IF COALESCE((SELECT value = 'true'::jsonb FROM public.dating_settings
               WHERE key = 'restrict_all_new_conversations_to_matches'), false) THEN
    v_other := CASE WHEN NEW.user1_id = v_uid THEN NEW.user2_id ELSE NEW.user1_id END;
    IF NOT (public.dating_is_match(v_uid, v_other) OR public.dating_has_entitlement(v_uid, 'message_without_match')) THEN
      RAISE EXCEPTION 'match_required: match with this member or upgrade to start a new chat'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS conversations_enforce_rules ON public.conversations;
CREATE TRIGGER conversations_enforce_rules
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conversation_rules();

-- 6. Admin setup status for the dashboard checklist.
CREATE OR REPLACE FUNCTION public.admin_dating_setup_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'paid_plan_active', EXISTS (SELECT 1 FROM public.subscription_plans
                                WHERE tier <> 'free' AND is_active AND COALESCE(promo_price_minor, price_minor) > 0),
    'keys_saved', EXISTS (SELECT 1 FROM public.payment_secret_settings),
    'provider_enabled', EXISTS (SELECT 1 FROM public.payment_providers WHERE is_enabled),
    'webhook_received', EXISTS (SELECT 1 FROM public.payment_webhook_events WHERE signature_valid),
    'test_payment_ok', EXISTS (SELECT 1 FROM public.payment_transactions WHERE status = 'success' AND mode = 'test'),
    'live_enabled', EXISTS (SELECT 1 FROM public.payment_providers WHERE is_enabled AND mode = 'live'),
    'dating_profiles', (SELECT count(*) FROM public.relationship_profiles WHERE is_active),
    'matches', (SELECT count(*) FROM public.dating_matches)
  );
END;
$$;

-- 7. Permissions (Supabase grants EXECUTE to API roles by default).
REVOKE EXECUTE ON FUNCTION public.dating_settings_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_conversation_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dating_is_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dating_conversation_between(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dating_start_conversation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_dating_setup_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dating_start_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dating_setup_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dating_is_match(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dating_conversation_between(uuid, uuid) TO service_role;
