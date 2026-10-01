-- Connections: member privacy controls + first-message anti-spam rule.
--
-- Privacy (every member):
--   * relationship_profiles.incognito ("private mode"): hidden from Discover
--     and Browse. Only people the member has reached out to (sent a connect
--     request) or is connected with can see the profile.
--   * profiles.message_privacy: who may start a NEW conversation with them:
--     'everyone' (default) | 'connections' (mutual connections only) | 'nobody'.
--     Admins are exempt (moderation/support). Existing chats are unaffected;
--     members can still block anyone.
--
-- Anti-spam:
--   * Members without the "send_before_reply" entitlement (free plan) can
--     send a limited number of messages (default 1) in a conversation until
--     the other person replies. After the first reply, chat flows normally.
--     Call-log entries ("[call:...]") don't count.

-- 1. Columns ------------------------------------------------------------------
ALTER TABLE public.relationship_profiles ADD COLUMN IF NOT EXISTS incognito boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS message_privacy text NOT NULL DEFAULT 'everyone';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_message_privacy_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_message_privacy_check CHECK (message_privacy IN ('everyone', 'connections', 'nobody'));
  END IF;
END
$$;

-- 2. Settings + entitlement ---------------------------------------------------
ALTER TABLE public.dating_settings DROP CONSTRAINT IF EXISTS dating_settings_key_check;
ALTER TABLE public.dating_settings
  ADD CONSTRAINT dating_settings_key_check
  CHECK (key IN ('restrict_all_new_conversations_to_matches', 'first_messages_before_reply'));
INSERT INTO public.dating_settings (key, value) VALUES ('first_messages_before_reply', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE public.subscription_plans
   SET limits = limits || jsonb_build_object('send_before_reply', tier <> 'free')
 WHERE NOT (limits ? 'send_before_reply');

-- Professional wording for the seeded plan features, only where an admin has
-- not already customised them.
UPDATE public.subscription_plans SET features =
  '["Create your profile", "Discover members across Abia and beyond", "Connect when interest is mutual", "Chat with your connections", "Privacy and message controls"]'::jsonb
 WHERE code = 'free'
   AND features = '["Create a dating profile", "Discover and like profiles", "Match and message", "Basic filters"]'::jsonb;
UPDATE public.subscription_plans SET features =
  '["Unlimited connection requests", "See who wants to connect with you", "Message members before connecting", "Send follow-up messages without waiting", "Advanced filters", "Verified member badge"]'::jsonb
 WHERE code IN ('premium_monthly', 'premium_yearly')
   AND features = '["Unlimited likes", "See who likes you", "Advanced filters", "Premium badge"]'::jsonb;
UPDATE public.subscription_plans SET features =
  '["Everything in Premium", "Priority visibility in Discover", "Priority member support"]'::jsonb
 WHERE code = 'vip_monthly'
   AND features = '["Everything in Premium", "Priority support"]'::jsonb;
UPDATE public.subscription_plans SET description = 'Everything you need to build real connections.'
 WHERE code = 'free' AND description = 'Everything you need to meet people.';
UPDATE public.subscription_plans SET description = 'Reach more people and grow your network faster.'
 WHERE code = 'premium_monthly' AND description = 'More likes, more control.';

-- 3. Helpers --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dating_has_reached_out(_from uuid, _to uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.dating_likes WHERE liker_id = _from AND liked_id = _to AND kind = 'like')
$$;

CREATE OR REPLACE FUNCTION public.member_message_privacy(_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE((SELECT message_privacy FROM public.profiles WHERE id = _uid), 'everyone') $$;

-- 4. Private mode in the directory ---------------------------------------------
-- Answers only "can the CURRENT member see this owner's private profile?"
-- (no arbitrary viewer argument, so it can't be used to probe other members).
CREATE OR REPLACE FUNCTION public.connections_profile_visible(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.dating_has_reached_out(_owner, auth.uid()) OR public.dating_is_match(_owner, auth.uid()))
$$;

-- The previous policy checked relationship_blocks as the viewer, but RLS on
-- that table only shows a member their OWN blocks, so a blocker's profile was
-- still visible to the person they blocked. Check blocks with definer rights,
-- in both directions, for the current member only.
CREATE OR REPLACE FUNCTION public.connections_blocked_with(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT auth.uid() IS NOT NULL AND public.dating_is_blocked(_owner, auth.uid()) $$;

DROP POLICY IF EXISTS "Authenticated can view active relationship profiles" ON public.relationship_profiles;
CREATE POLICY "Authenticated can view active relationship profiles"
  ON public.relationship_profiles FOR SELECT TO authenticated
  USING (
    is_active
    AND (user_id = auth.uid() OR NOT public.connections_blocked_with(user_id))
    AND (NOT incognito OR user_id = auth.uid() OR public.connections_profile_visible(user_id))
  );

-- Private-mode members don't appear in "people interested in you" lists of
-- people they have not reached out to — they only reach people they chose.
-- (dating_likes_received already lists only people who reached out to you.)

-- 5. Member privacy settings API -------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_privacy()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'message_privacy', public.member_message_privacy(auth.uid()),
    'incognito', COALESCE((SELECT incognito FROM public.relationship_profiles WHERE user_id = auth.uid()), false),
    'has_connections_profile', EXISTS (SELECT 1 FROM public.relationship_profiles WHERE user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.set_my_privacy(_message_privacy text DEFAULT NULL, _incognito boolean DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF _message_privacy IS NOT NULL THEN
    IF _message_privacy NOT IN ('everyone', 'connections', 'nobody') THEN
      RAISE EXCEPTION 'Invalid message setting' USING ERRCODE = '22023';
    END IF;
    UPDATE public.profiles SET message_privacy = _message_privacy WHERE id = auth.uid();
  END IF;
  IF _incognito IS NOT NULL THEN
    UPDATE public.relationship_profiles SET incognito = _incognito WHERE user_id = auth.uid();
  END IF;
  RETURN public.get_my_privacy();
END;
$$;

-- 6. Respect message privacy when starting chats ---------------------------------
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
  v_privacy text;
  v_match boolean;
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

  v_existing := public.dating_conversation_between(v_uid, _target);
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'conversation_id', v_existing, 'created', false);
  END IF;

  v_match := public.dating_is_match(v_uid, _target);
  v_privacy := public.member_message_privacy(_target);
  IF NOT public.is_admin(v_uid) THEN
    IF v_privacy = 'nobody' THEN
      RETURN jsonb_build_object('status', 'messages_off');
    ELSIF v_privacy = 'connections' AND NOT v_match THEN
      RETURN jsonb_build_object('status', 'connections_only');
    END IF;
  END IF;

  IF NOT (v_match OR public.dating_has_entitlement(v_uid, 'message_without_match')) THEN
    PERFORM public.log_monetization_event(v_uid, 'MESSAGE_PAYWALL', '{}'::jsonb);
    RETURN jsonb_build_object('status', 'match_required');
  END IF;

  INSERT INTO public.conversations (user1_id, user2_id)
  VALUES (LEAST(v_uid, _target), GREATEST(v_uid, _target))
  RETURNING id INTO v_new;
  PERFORM public.log_monetization_event(v_uid, 'MESSAGE_STARTED', jsonb_build_object('matched', v_match));
  RETURN jsonb_build_object('status', 'ok', 'conversation_id', v_new, 'created', true);
END;
$$;

-- Every new conversation (forum or Connections) respects the recipient's
-- message setting, plus the optional site-wide "connect first" rule.
CREATE OR REPLACE FUNCTION public.enforce_conversation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_other uuid;
  v_privacy text;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN RETURN NEW; END IF;
  v_other := CASE WHEN NEW.user1_id = v_uid THEN NEW.user2_id ELSE NEW.user1_id END;

  v_privacy := public.member_message_privacy(v_other);
  IF v_privacy = 'nobody' THEN
    RAISE EXCEPTION 'messages_off: this member is not accepting new messages' USING ERRCODE = 'P0001';
  ELSIF v_privacy = 'connections' AND NOT public.dating_is_match(v_uid, v_other) THEN
    RAISE EXCEPTION 'connections_only: this member only accepts messages from connections' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE((SELECT value = 'true'::jsonb FROM public.dating_settings
               WHERE key = 'restrict_all_new_conversations_to_matches'), false) THEN
    IF NOT (public.dating_is_match(v_uid, v_other) OR public.dating_has_entitlement(v_uid, 'message_without_match')) THEN
      RAISE EXCEPTION 'match_required: connect with this member or upgrade to start a new chat' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. First-message anti-spam ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_message_reply_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer;
  v_sent integer;
BEGIN
  IF v_uid IS NULL OR public.is_admin(v_uid) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.content, '') LIKE '[call:%' THEN RETURN NEW; END IF;  -- call logs
  IF public.dating_has_entitlement(NEW.sender_id, 'send_before_reply') THEN RETURN NEW; END IF;

  -- Once the other person has replied, the conversation flows normally.
  IF EXISTS (SELECT 1 FROM public.messages m
             WHERE m.conversation_id = NEW.conversation_id AND m.sender_id <> NEW.sender_id) THEN
    RETURN NEW;
  END IF;

  v_limit := COALESCE((SELECT (value #>> '{}')::integer FROM public.dating_settings
                       WHERE key = 'first_messages_before_reply'), 1);
  SELECT count(*) INTO v_sent FROM public.messages m
  WHERE m.conversation_id = NEW.conversation_id AND m.sender_id = NEW.sender_id
    AND COALESCE(m.content, '') NOT LIKE '[call:%';
  IF v_sent >= v_limit THEN
    RAISE EXCEPTION 'awaiting_reply: wait for a reply before sending more messages' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_enforce_reply_rule ON public.messages;
CREATE TRIGGER messages_enforce_reply_rule
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_reply_rule();

-- Lets the chat screen explain the wait before the member tries to send.
CREATE OR REPLACE FUNCTION public.conversation_send_status(_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer;
  v_sent integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c
                 WHERE c.id = _conversation_id AND v_uid IN (c.user1_id, c.user2_id)) THEN
    RAISE EXCEPTION 'Not found' USING ERRCODE = '42704';
  END IF;
  IF public.is_admin(v_uid) OR public.dating_has_entitlement(v_uid, 'send_before_reply')
     OR EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = _conversation_id AND m.sender_id <> v_uid) THEN
    RETURN jsonb_build_object('can_send', true);
  END IF;
  v_limit := COALESCE((SELECT (value #>> '{}')::integer FROM public.dating_settings
                       WHERE key = 'first_messages_before_reply'), 1);
  SELECT count(*) INTO v_sent FROM public.messages m
  WHERE m.conversation_id = _conversation_id AND m.sender_id = v_uid AND COALESCE(m.content, '') NOT LIKE '[call:%';
  RETURN jsonb_build_object('can_send', v_sent < v_limit, 'remaining', GREATEST(v_limit - v_sent, 0), 'limit', v_limit);
END;
$$;

-- 8. Permissions -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.dating_has_reached_out(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connections_profile_visible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connections_blocked_with(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_message_privacy(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_privacy() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_privacy(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_message_reply_rule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.conversation_send_status(uuid) FROM PUBLIC, anon;
-- Evaluated inside the relationship_profiles policy for signed-in members.
GRANT EXECUTE ON FUNCTION public.connections_profile_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connections_blocked_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dating_has_reached_out(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_privacy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_privacy(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_send_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_message_privacy(uuid) TO service_role;
