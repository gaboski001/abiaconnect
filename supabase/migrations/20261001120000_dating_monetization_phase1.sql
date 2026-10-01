-- ============================================================================
-- Dating monetization — Phase 1
--   * Likes & matches (server-enforced daily limits)
--   * Admin-configurable plans + feature limits (no prices/limits in code)
--   * Central entitlement functions
--   * Payment providers (Paystack / Monnify / Squad), switchable by admins
--   * Payment transactions, idempotent webhook events, per-provider logs
--   * Wallet + append-only ledger (spent by later phases)
--   * Funnel analytics events and an admin audit log
--
-- Server-authoritative: clients never write money/entitlement tables. All
-- state changes go through SECURITY DEFINER functions; payment functions are
-- callable by the service role (edge functions) only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- "Today" for daily limits, in the community's time zone.
CREATE OR REPLACE FUNCTION public.dating_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Africa/Lagos')::date $$;

-- True when the user may take part in dating/monetized actions.
CREATE OR REPLACE FUNCTION public.dating_user_in_good_standing(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _uid AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
  )
$$;

-- True when either user has blocked the other (dating blocks).
CREATE OR REPLACE FUNCTION public.dating_is_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.relationship_blocks b
    WHERE (b.user_id = _a AND b.blocked_id = _b) OR (b.user_id = _b AND b.blocked_id = _a)
  )
$$;

-- ---------------------------------------------------------------------------
-- Likes & matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dating_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('like', 'pass')),
  seen_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (liker_id, liked_id),
  CHECK (liker_id <> liked_id)
);
CREATE INDEX IF NOT EXISTS dating_likes_liked_idx ON public.dating_likes (liked_id, kind, created_at DESC);
ALTER TABLE public.dating_likes ENABLE ROW LEVEL SECURITY;
-- Users may read only the reactions they sent. Received likes are exposed via
-- dating_likes_received(), which enforces the SEE_LIKES entitlement.
DROP POLICY IF EXISTS "Users read likes they sent" ON public.dating_likes;
CREATE POLICY "Users read likes they sent"
  ON public.dating_likes FOR SELECT TO authenticated
  USING (liker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.dating_matches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_high  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_low, user_high),
  CHECK (user_low < user_high)
);
ALTER TABLE public.dating_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their matches" ON public.dating_matches;
CREATE POLICY "Users read their matches"
  ON public.dating_matches FOR SELECT TO authenticated
  USING (auth.uid() IN (user_low, user_high));

-- ---------------------------------------------------------------------------
-- Plans & limits (admin-configurable)
-- limits keys (all optional):
--   daily_likes        int | null   (null = unlimited)
--   see_likes          bool         full "Likes You" list
--   likes_you_preview  int          blurred preview count for free users
--   advanced_filters   bool
--   premium_badge      bool
--   remove_ads         bool
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name             text NOT NULL,
  description      text,
  tier             text NOT NULL DEFAULT 'premium' CHECK (tier IN ('free', 'premium', 'vip')),
  price_minor      bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  promo_price_minor bigint CHECK (promo_price_minor IS NULL OR promo_price_minor >= 0),
  currency         text NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN', 'USD')),
  billing_period   text NOT NULL DEFAULT 'month' CHECK (billing_period IN ('month', 'year')),
  duration_days    integer NOT NULL DEFAULT 30 CHECK (duration_days BETWEEN 1 AND 3660),
  features         jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits           jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active        boolean NOT NULL DEFAULT false,
  is_visible       boolean NOT NULL DEFAULT true,
  is_recommended   boolean NOT NULL DEFAULT false,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active visible plans" ON public.subscription_plans;
CREATE POLICY "Anyone reads active visible plans"
  ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING ((is_active AND is_visible) OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid())));
DROP POLICY IF EXISTS "Admins manage plans" ON public.subscription_plans;
CREATE POLICY "Admins manage plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Seed: the free plan is live; paid plans start INACTIVE so nothing is sold
-- until an admin has reviewed prices and switched them on.
INSERT INTO public.subscription_plans
  (code, name, description, tier, price_minor, currency, billing_period, duration_days, features, limits, is_active, is_visible, is_recommended, sort_order)
VALUES
  ('free', 'Free', 'Everything you need to meet people.', 'free', 0, 'NGN', 'month', 30,
   '["Create a dating profile", "Discover and like profiles", "Match and message", "Basic filters"]'::jsonb,
   '{"daily_likes": 25, "see_likes": false, "likes_you_preview": 3, "advanced_filters": false, "premium_badge": false, "remove_ads": false}'::jsonb,
   true, true, false, 0),
  ('premium_monthly', 'Premium', 'More likes, more control.', 'premium', 499900, 'NGN', 'month', 30,
   '["Unlimited likes", "See who likes you", "Advanced filters", "Premium badge"]'::jsonb,
   '{"daily_likes": null, "see_likes": true, "likes_you_preview": 0, "advanced_filters": true, "premium_badge": true, "remove_ads": true}'::jsonb,
   false, true, true, 10),
  ('premium_yearly', 'Premium (Yearly)', 'Premium for a full year.', 'premium', 3999900, 'NGN', 'year', 365,
   '["Unlimited likes", "See who likes you", "Advanced filters", "Premium badge"]'::jsonb,
   '{"daily_likes": null, "see_likes": true, "likes_you_preview": 0, "advanced_filters": true, "premium_badge": true, "remove_ads": true}'::jsonb,
   false, true, false, 11),
  ('vip_monthly', 'VIP', 'Everything in Premium, plus priority.', 'vip', 999900, 'NGN', 'month', 30,
   '["Everything in Premium", "Priority support"]'::jsonb,
   '{"daily_likes": null, "see_likes": true, "likes_you_preview": 0, "advanced_filters": true, "premium_badge": true, "remove_ads": true}'::jsonb,
   false, true, false, 20)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Subscriptions (prepaid access windows; no auto-renew in Phase 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id     uuid NOT NULL REFERENCES public.subscription_plans(id),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'refunded')),
  source      text NOT NULL CHECK (source IN ('payment', 'admin_grant')),
  payment_id  uuid,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS user_subscriptions_user_idx ON public.user_subscriptions (user_id, ends_at DESC);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users read own subscriptions"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Entitlements (single source of truth; used by every premium function)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dating_current_plan(_uid uuid)
RETURNS public.subscription_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Best currently-active paid plan, otherwise the free plan.
  SELECT p.* FROM public.subscription_plans p
  WHERE p.code = 'free'
     OR p.id IN (
       SELECT s.plan_id FROM public.user_subscriptions s
       WHERE s.user_id = _uid AND s.status = 'active' AND now() >= s.starts_at AND now() < s.ends_at
     )
  ORDER BY (p.code <> 'free') DESC, p.sort_order DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.dating_has_entitlement(_uid uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE((public.dating_current_plan(_uid)).limits ->> _key, 'false') = 'true' $$;

-- Returns NULL for unlimited.
CREATE OR REPLACE FUNCTION public.dating_limit(_uid uuid, _key text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT NULLIF((public.dating_current_plan(_uid)).limits ->> _key, '')::integer $$;

-- What the signed-in user is entitled to right now (for the UI; the server
-- re-checks entitlements on every protected action).
CREATE OR REPLACE FUNCTION public.get_my_dating_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.subscription_plans;
  v_ends timestamptz;
  v_used integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  v_plan := public.dating_current_plan(v_uid);
  SELECT max(s.ends_at) INTO v_ends
  FROM public.user_subscriptions s
  WHERE s.user_id = v_uid AND s.status = 'active' AND s.plan_id = v_plan.id AND now() < s.ends_at;
  SELECT u.count INTO v_used FROM public.feature_usage u
  WHERE u.user_id = v_uid AND u.feature = 'like' AND u.period_start = public.dating_today();
  RETURN jsonb_build_object(
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'tier', v_plan.tier,
    'is_premium', v_plan.tier <> 'free',
    'ends_at', v_ends,
    'limits', v_plan.limits,
    'likes_used_today', COALESCE(v_used, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Feature usage (daily counters)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_usage (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature      text NOT NULL,
  period_start date NOT NULL,
  count        integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (user_id, feature, period_start)
);
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own usage" ON public.feature_usage;
CREATE POLICY "Users read own usage"
  ON public.feature_usage FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Analytics events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monetization_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event      text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monetization_events_event_idx ON public.monetization_events (event, created_at DESC);
ALTER TABLE public.monetization_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read monetization events" ON public.monetization_events;
CREATE POLICY "Admins read monetization events"
  ON public.monetization_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_monetization_event(_uid uuid, _event text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ INSERT INTO public.monetization_events (user_id, event, metadata) VALUES (_uid, _event, COALESCE(_metadata, '{}'::jsonb)) $$;

-- Client-reported funnel events (views/clicks only; money events are server-side).
CREATE OR REPLACE FUNCTION public.track_monetization_event(_event text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _event NOT IN ('DISCOVERY_VIEWED', 'PREMIUM_PAGE_VIEWED', 'PAYWALL_VIEWED', 'PRODUCT_SELECTED', 'LIKES_YOU_VIEWED') THEN
    RAISE EXCEPTION 'Unknown event' USING ERRCODE = '22023';
  END IF;
  PERFORM public.enforce_client_rate_limit('track_monetization_event', 60, 60);
  -- Keep metadata small and free of personal data.
  PERFORM public.log_monetization_event(auth.uid(), _event, jsonb_strip_nulls(COALESCE(_metadata, '{}'::jsonb)) - 'email' - 'name');
END;
$$;

-- ---------------------------------------------------------------------------
-- Like / pass (server-enforced limits, blocks and account standing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dating_react(_target uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
  v_limit integer;
  v_count integer;
  v_matched boolean := false;
  v_match_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF _kind NOT IN ('like', 'pass') THEN RAISE EXCEPTION 'Invalid reaction' USING ERRCODE = '22023'; END IF;
  IF _target IS NULL OR _target = v_uid THEN RAISE EXCEPTION 'Invalid profile' USING ERRCODE = '22023'; END IF;
  PERFORM public.enforce_client_rate_limit('dating_react', 120, 60);

  IF NOT public.dating_user_in_good_standing(v_uid) THEN
    RETURN jsonb_build_object('status', 'account_restricted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.relationship_profiles WHERE user_id = v_uid AND is_active) THEN
    RETURN jsonb_build_object('status', 'profile_required');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.relationship_profiles WHERE user_id = _target AND is_active)
     OR NOT public.dating_user_in_good_standing(_target)
     OR public.dating_is_blocked(v_uid, _target) THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;

  SELECT kind INTO v_prev FROM public.dating_likes WHERE liker_id = v_uid AND liked_id = _target;

  -- Only a NEW like counts against the daily limit.
  IF _kind = 'like' AND v_prev IS DISTINCT FROM 'like' THEN
    v_limit := public.dating_limit(v_uid, 'daily_likes');
    IF v_limit IS NOT NULL THEN
      IF v_limit <= 0 THEN
        RETURN jsonb_build_object('status', 'limit_reached', 'likes_remaining', 0);
      END IF;
      -- Atomic check-and-increment: the row lock serialises concurrent likes.
      INSERT INTO public.feature_usage AS u (user_id, feature, period_start, count)
      VALUES (v_uid, 'like', public.dating_today(), 1)
      ON CONFLICT (user_id, feature, period_start)
      DO UPDATE SET count = u.count + 1 WHERE u.count < v_limit
      RETURNING u.count INTO v_count;
      IF v_count IS NULL THEN
        PERFORM public.log_monetization_event(v_uid, 'LIKE_LIMIT_REACHED', jsonb_build_object('limit', v_limit));
        RETURN jsonb_build_object('status', 'limit_reached', 'likes_remaining', 0);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.dating_likes (liker_id, liked_id, kind)
  VALUES (v_uid, _target, _kind)
  ON CONFLICT (liker_id, liked_id) DO UPDATE SET kind = EXCLUDED.kind, created_at = now(), seen_at = NULL;

  IF _kind = 'like' AND v_prev IS DISTINCT FROM 'like' THEN
    PERFORM public.log_monetization_event(v_uid, 'LIKE_SENT', '{}'::jsonb);

    IF EXISTS (SELECT 1 FROM public.dating_likes WHERE liker_id = _target AND liked_id = v_uid AND kind = 'like') THEN
      INSERT INTO public.dating_matches (user_low, user_high)
      VALUES (LEAST(v_uid, _target), GREATEST(v_uid, _target))
      ON CONFLICT (user_low, user_high) DO NOTHING
      RETURNING id INTO v_match_id;
      v_matched := true;
      IF v_match_id IS NOT NULL THEN
        PERFORM public.log_monetization_event(v_uid, 'MATCH_CREATED', jsonb_build_object('match_id', v_match_id));
        INSERT INTO public.notifications (user_id, type, message, link) VALUES
          (v_uid, 'dating_match', 'It''s a match! Say hello.', '/relationship/likes?tab=matches'),
          (_target, 'dating_match', 'It''s a match! Say hello.', '/relationship/likes?tab=matches');
      END IF;
    ELSIF NOT EXISTS (
      -- At most one anonymous "someone liked you" notification per 6 hours.
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = _target AND n.type = 'dating_like' AND n.created_at > now() - interval '6 hours'
    ) THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (_target, 'dating_like', 'Someone liked your dating profile.', '/relationship/likes');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'matched', v_matched,
    'likes_remaining', CASE WHEN v_limit IS NULL THEN NULL ELSE GREATEST(v_limit - COALESCE(v_count, 0), 0) END
  );
END;
$$;

-- "Likes You": full list only with the SEE_LIKES entitlement. Free users get
-- counts and an anonymous preview size, never identities.
CREATE OR REPLACE FUNCTION public.dating_likes_received(_limit integer DEFAULT 20, _offset integer DEFAULT 0, _unseen_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_entitled boolean;
  v_total integer;
  v_unseen integer;
  v_items jsonb := '[]'::jsonb;
  v_preview integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  v_entitled := public.dating_user_in_good_standing(v_uid) AND public.dating_has_entitlement(v_uid, 'see_likes');

  WITH likers AS (
    SELECT l.liker_id, l.created_at AS liked_at, l.seen_at
    FROM public.dating_likes l
    JOIN public.relationship_profiles rp ON rp.user_id = l.liker_id AND rp.is_active
    JOIN public.profiles p ON p.id = l.liker_id AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
    WHERE l.liked_id = v_uid AND l.kind = 'like'
      AND NOT public.dating_is_blocked(v_uid, l.liker_id)
      -- Already reacted to them: they are a match or a pass, not a pending like.
      AND NOT EXISTS (SELECT 1 FROM public.dating_likes mine WHERE mine.liker_id = v_uid AND mine.liked_id = l.liker_id)
  )
  SELECT count(*), count(*) FILTER (WHERE seen_at IS NULL) INTO v_total, v_unseen FROM likers;

  v_preview := LEAST(v_total, COALESCE(public.dating_limit(v_uid, 'likes_you_preview'), 0));

  IF v_entitled THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.liked_at DESC), '[]'::jsonb) INTO v_items
    FROM (
      SELECT l.liker_id AS user_id, l.created_at AS liked_at, (l.seen_at IS NULL) AS unseen,
             p.display_name, p.username, p.avatar_url,
             rp.headline, rp.dob, rp.lga, rp.photos[1] AS photo
      FROM public.dating_likes l
      JOIN public.relationship_profiles rp ON rp.user_id = l.liker_id AND rp.is_active
      JOIN public.profiles p ON p.id = l.liker_id AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
      WHERE l.liked_id = v_uid AND l.kind = 'like'
        AND NOT public.dating_is_blocked(v_uid, l.liker_id)
        AND NOT EXISTS (SELECT 1 FROM public.dating_likes mine WHERE mine.liker_id = v_uid AND mine.liked_id = l.liker_id)
        AND (NOT _unseen_only OR l.seen_at IS NULL)
      ORDER BY l.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 50) OFFSET GREATEST(COALESCE(_offset, 0), 0)
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'entitled', v_entitled,
    'total', v_total,
    'unseen', v_unseen,
    'preview_count', CASE WHEN v_entitled THEN 0 ELSE v_preview END,
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dating_mark_likes_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  -- Only premium users actually see who liked them, so only they mark seen.
  IF public.dating_has_entitlement(auth.uid(), 'see_likes') THEN
    UPDATE public.dating_likes SET seen_at = now()
    WHERE liked_id = auth.uid() AND kind = 'like' AND seen_at IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.dating_my_matches(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.matched_at DESC), '[]'::jsonb)
  FROM (
    SELECT o.other_id AS user_id, m.created_at AS matched_at,
           p.display_name, p.username, p.avatar_url, rp.headline, rp.dob, rp.lga, rp.photos[1] AS photo
    FROM public.dating_matches m
    CROSS JOIN LATERAL (SELECT CASE WHEN m.user_low = auth.uid() THEN m.user_high ELSE m.user_low END AS other_id) o
    JOIN public.profiles p ON p.id = o.other_id AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
    LEFT JOIN public.relationship_profiles rp ON rp.user_id = o.other_id
    WHERE auth.uid() IN (m.user_low, m.user_high)
      AND NOT public.dating_is_blocked(auth.uid(), o.other_id)
    ORDER BY m.created_at DESC
    LIMIT LEAST(GREATEST(_limit, 1), 100) OFFSET GREATEST(_offset, 0)
  ) x
$$;

-- ---------------------------------------------------------------------------
-- Payment providers (admins switch each on/off; secrets live in env vars)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_providers (
  provider      text PRIMARY KEY CHECK (provider IN ('paystack', 'monnify', 'squad')),
  display_name  text NOT NULL,
  is_enabled    boolean NOT NULL DEFAULT false,
  mode          text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  -- Monnify only: contract code from the Monnify dashboard (not a secret).
  contract_code text,
  sort_order    integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage payment providers" ON public.payment_providers;
CREATE POLICY "Admins manage payment providers"
  ON public.payment_providers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.payment_providers (provider, display_name, sort_order) VALUES
  ('paystack', 'Paystack', 1), ('monnify', 'Monnify', 2), ('squad', 'Squad', 3)
ON CONFLICT (provider) DO NOTHING;

-- Enabled providers for the checkout screen (no config details exposed).
CREATE OR REPLACE FUNCTION public.get_payment_options()
RETURNS TABLE (provider text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT provider, display_name FROM public.payment_providers WHERE is_enabled ORDER BY sort_order $$;

-- ---------------------------------------------------------------------------
-- Payment transactions, webhook events, provider logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider           text NOT NULL CHECK (provider IN ('paystack', 'monnify', 'squad')),
  reference          text NOT NULL UNIQUE,
  provider_reference text,
  purpose            text NOT NULL DEFAULT 'subscription' CHECK (purpose IN ('subscription')),
  plan_id            uuid REFERENCES public.subscription_plans(id),
  amount_minor       bigint NOT NULL CHECK (amount_minor > 0),
  currency           text NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'success', 'failed', 'abandoned', 'refunded', 'amount_mismatch')),
  checkout_url       text,
  failure_reason     text,
  mode               text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  verified_at        timestamptz,
  refunded_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_ref_uidx
  ON public.payment_transactions (provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_transactions_user_idx ON public.payment_transactions (user_id, created_at DESC);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payments" ON public.payment_transactions;
CREATE POLICY "Users read own payments"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  event_key       text NOT NULL,
  event_type      text,
  reference       text,
  signature_valid boolean NOT NULL,
  payload         jsonb,
  received_at     timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  process_result  text,
  UNIQUE (provider, event_key)
);
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read webhook events" ON public.payment_webhook_events;
CREATE POLICY "Admins read webhook events"
  ON public.payment_webhook_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_provider_logs (
  id          bigserial PRIMARY KEY,
  provider    text NOT NULL,
  action      text NOT NULL,
  reference   text,
  http_status integer,
  ok          boolean NOT NULL DEFAULT false,
  duration_ms integer,
  request     jsonb,
  response    jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_provider_logs_idx ON public.payment_provider_logs (provider, created_at DESC);
ALTER TABLE public.payment_provider_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read provider logs" ON public.payment_provider_logs;
CREATE POLICY "Admins read provider logs"
  ON public.payment_provider_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Create a pending transaction. Price comes from the plan row, never the client.
CREATE OR REPLACE FUNCTION public.payment_create_transaction(_user uuid, _plan_id uuid, _provider text)
RETURNS public.payment_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans;
  v_prov public.payment_providers;
  v_tx public.payment_transactions;
BEGIN
  IF NOT public.dating_user_in_good_standing(_user) THEN
    RAISE EXCEPTION 'account_restricted' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_prov FROM public.payment_providers WHERE provider = _provider AND is_enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'provider_unavailable' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_plan FROM public.subscription_plans
  WHERE id = _plan_id AND is_active AND is_visible AND tier <> 'free' AND COALESCE(promo_price_minor, price_minor) > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_unavailable' USING ERRCODE = 'P0001'; END IF;
  -- Checkout abuse guard: at most 10 open checkouts per user per hour.
  IF (SELECT count(*) FROM public.payment_transactions
      WHERE user_id = _user AND status = 'pending' AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'too_many_checkouts' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.payment_transactions (user_id, provider, reference, plan_id, amount_minor, currency, mode)
  VALUES (
    _user, _provider,
    -- Alphanumeric only (Squad requires it); unique across all providers.
    'ABIA' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)),
    v_plan.id, COALESCE(v_plan.promo_price_minor, v_plan.price_minor), v_plan.currency, v_prov.mode
  )
  RETURNING * INTO v_tx;

  PERFORM public.log_monetization_event(_user, 'CHECKOUT_STARTED',
    jsonb_build_object('plan', v_plan.code, 'provider', _provider, 'reference', v_tx.reference));
  RETURN v_tx;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_attach_checkout(_reference text, _provider_reference text, _checkout_url text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.payment_transactions
     SET provider_reference = COALESCE(_provider_reference, provider_reference),
         checkout_url = _checkout_url
   WHERE reference = _reference AND status = 'pending'
$$;

-- Apply a VERIFIED provider result. Idempotent: a success is fulfilled once,
-- no matter how many webhooks/verify calls arrive (row lock + status check).
CREATE OR REPLACE FUNCTION public.payment_apply_result(
  _provider text,
  _reference text,
  _status text,
  _paid_minor bigint,
  _currency text,
  _provider_reference text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.payment_transactions;
  v_plan public.subscription_plans;
  v_start timestamptz;
  v_sub_id uuid;
BEGIN
  IF _status NOT IN ('success', 'failed', 'abandoned') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE reference = _reference AND provider = _provider
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_reference'; END IF;

  IF v_tx.status = 'success' THEN RETURN 'already_fulfilled'; END IF;
  IF v_tx.status IN ('refunded', 'amount_mismatch') THEN RETURN 'ignored_' || v_tx.status; END IF;

  IF _status <> 'success' THEN
    IF v_tx.status = 'pending' THEN
      UPDATE public.payment_transactions
         SET status = _status, verified_at = now(), failure_reason = _status,
             provider_reference = COALESCE(provider_reference, _provider_reference)
       WHERE id = v_tx.id;
      PERFORM public.log_monetization_event(v_tx.user_id, 'PAYMENT_FAILED',
        jsonb_build_object('reference', v_tx.reference, 'provider', _provider, 'status', _status));
    END IF;
    RETURN 'marked_' || _status;
  END IF;

  -- Never grant more than was paid, or in the wrong currency.
  IF _paid_minor IS NULL OR _paid_minor < v_tx.amount_minor OR upper(COALESCE(_currency, '')) <> upper(v_tx.currency) THEN
    UPDATE public.payment_transactions
       SET status = 'amount_mismatch', verified_at = now(),
           failure_reason = format('paid %s %s, expected %s %s', _paid_minor, _currency, v_tx.amount_minor, v_tx.currency)
     WHERE id = v_tx.id;
    PERFORM public.log_monetization_event(v_tx.user_id, 'PAYMENT_AMOUNT_MISMATCH',
      jsonb_build_object('reference', v_tx.reference, 'provider', _provider));
    RETURN 'amount_mismatch';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_tx.plan_id;

  -- Renewing the same plan extends from the end of the current window.
  SELECT GREATEST(now(), COALESCE(max(s.ends_at), now())) INTO v_start
  FROM public.user_subscriptions s
  WHERE s.user_id = v_tx.user_id AND s.plan_id = v_plan.id AND s.status = 'active' AND s.ends_at > now();

  UPDATE public.payment_transactions
     SET status = 'success', verified_at = now(),
         provider_reference = COALESCE(provider_reference, _provider_reference)
   WHERE id = v_tx.id;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, source, payment_id, starts_at, ends_at)
  VALUES (v_tx.user_id, v_plan.id, 'active', 'payment', v_tx.id, v_start,
          v_start + make_interval(days => v_plan.duration_days))
  RETURNING id INTO v_sub_id;

  PERFORM public.log_monetization_event(v_tx.user_id, 'PAYMENT_SUCCESS',
    jsonb_build_object('reference', v_tx.reference, 'provider', _provider, 'amount_minor', v_tx.amount_minor, 'currency', v_tx.currency));
  PERFORM public.log_monetization_event(v_tx.user_id, 'SUBSCRIPTION_STARTED',
    jsonb_build_object('plan', v_plan.code, 'subscription_id', v_sub_id));
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (v_tx.user_id, 'payment_success',
          format('Payment successful. Your %s benefits are now active.', v_plan.name), '/relationship/premium');
  RETURN 'fulfilled';
END;
$$;

-- Refund reported (and verified) by a provider: mark it, revoke the access
-- it paid for, keep the records (nothing is deleted).
CREATE OR REPLACE FUNCTION public.payment_apply_refund(_provider text, _ref text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.payment_transactions;
BEGIN
  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE provider = _provider AND (reference = _ref OR provider_reference = _ref)
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_reference'; END IF;
  IF v_tx.status = 'refunded' THEN RETURN 'already_refunded'; END IF;
  IF v_tx.status <> 'success' THEN RETURN 'ignored_' || v_tx.status; END IF;

  UPDATE public.payment_transactions SET status = 'refunded', refunded_at = now() WHERE id = v_tx.id;
  UPDATE public.user_subscriptions SET status = 'refunded', note = 'Refunded by provider'
   WHERE payment_id = v_tx.id AND status = 'active';
  PERFORM public.log_monetization_event(v_tx.user_id, 'REFUND_ISSUED',
    jsonb_build_object('reference', v_tx.reference, 'provider', _provider));
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (v_tx.user_id, 'payment_refund', 'Your payment was refunded and the related benefits have ended.', '/relationship/premium');
  RETURN 'refunded';
END;
$$;

-- ---------------------------------------------------------------------------
-- Wallet + append-only ledger (credits are spent in later phases)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet" ON public.wallets;
CREATE POLICY "Users read own wallet"
  ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('PURCHASE', 'BONUS', 'BOOST_SPEND', 'SUPERLIKE_SPEND', 'GIFT_SEND',
                                               'REFUND', 'ADMIN_ADJUSTMENT', 'PROMOTION', 'REVERSAL')),
  amount          bigint NOT NULL CHECK (amount <> 0),
  balance_before  bigint NOT NULL,
  balance_after   bigint NOT NULL CHECK (balance_after >= 0),
  reference_id    text,
  payment_id      uuid REFERENCES public.payment_transactions(id),
  idempotency_key text NOT NULL UNIQUE,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (balance_after = balance_before + amount)
);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON public.wallet_transactions (user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users read own wallet transactions"
  ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- The ONLY way balances change: lock the wallet, write the ledger row and the
-- new balance in one transaction. Replaying an idempotency key is a no-op.
CREATE OR REPLACE FUNCTION public.wallet_apply(
  _user uuid, _amount bigint, _type text, _idempotency_key text,
  _reference_id text DEFAULT NULL, _payment_id uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.wallet_transactions;
  v_balance bigint;
  v_row public.wallet_transactions;
BEGIN
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM public.wallet_transactions WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  INSERT INTO public.wallets (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = _user FOR UPDATE;

  -- Re-check after taking the lock (a concurrent call may have won).
  SELECT * INTO v_existing FROM public.wallet_transactions WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  IF v_balance + _amount < 0 THEN RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, reference_id, payment_id, idempotency_key, metadata)
  VALUES (_user, _type, _amount, v_balance, v_balance + _amount, _reference_id, _payment_id, _idempotency_key, COALESCE(_metadata, '{}'::jsonb))
  RETURNING * INTO v_row;
  UPDATE public.wallets SET balance = v_balance + _amount, updated_at = now() WHERE user_id = _user;
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin audit log + admin actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monetization_audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid,
  action     text NOT NULL,
  target     text,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.monetization_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read monetization audit log" ON public.monetization_audit_log;
CREATE POLICY "Admins read monetization audit log"
  ON public.monetization_audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.monetization_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    NEW.updated_at := now();
    v_row := to_jsonb(NEW);
  ELSE
    v_row := to_jsonb(OLD);
  END IF;
  INSERT INTO public.monetization_audit_log (actor_id, action, target, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    COALESCE(v_row ->> 'code', v_row ->> 'provider'),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS subscription_plans_audit ON public.subscription_plans;
CREATE TRIGGER subscription_plans_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.monetization_audit_trigger();
DROP TRIGGER IF EXISTS payment_providers_audit ON public.payment_providers;
CREATE TRIGGER payment_providers_audit
  BEFORE INSERT OR UPDATE OR DELETE ON public.payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.monetization_audit_trigger();

-- Free plan must always exist and stay free.
CREATE OR REPLACE FUNCTION public.protect_free_plan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.code = 'free' THEN RAISE EXCEPTION 'The free plan cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.code = 'free' AND (NEW.code <> 'free' OR NEW.tier <> 'free' OR NEW.price_minor <> 0 OR NOT NEW.is_active) THEN
    RAISE EXCEPTION 'The free plan must stay active, free and coded "free"';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS subscription_plans_protect_free ON public.subscription_plans;
CREATE TRIGGER subscription_plans_protect_free
  BEFORE UPDATE OR DELETE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.protect_free_plan();

CREATE OR REPLACE FUNCTION public.admin_grant_subscription(_user uuid, _plan_code text, _days integer, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans;
  v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF _days IS NULL OR _days < 1 OR _days > 3660 THEN RAISE EXCEPTION 'Days must be between 1 and 3660'; END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE code = _plan_code AND tier <> 'free';
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown paid plan'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user) THEN RAISE EXCEPTION 'Unknown user'; END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, source, starts_at, ends_at, note)
  VALUES (_user, v_plan.id, 'active', 'admin_grant', now(), now() + make_interval(days => _days), _note)
  RETURNING id INTO v_id;
  INSERT INTO public.monetization_audit_log (actor_id, action, target, new_value)
  VALUES (auth.uid(), 'subscription.grant', _user::text,
          jsonb_build_object('subscription_id', v_id, 'plan', _plan_code, 'days', _days, 'note', _note));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_subscription(_subscription_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.user_subscriptions SET status = 'revoked', note = COALESCE(_note, note)
   WHERE id = _subscription_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'No active subscription with that id'; END IF;
  INSERT INTO public.monetization_audit_log (actor_id, action, target, new_value)
  VALUES (auth.uid(), 'subscription.revoke', _subscription_id::text, jsonb_build_object('note', _note));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_wallet_adjust(_user uuid, _amount bigint, _reason text)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.wallet_transactions;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  v_row := public.wallet_apply(_user, _amount, 'ADMIN_ADJUSTMENT', 'admin:' || gen_random_uuid()::text,
                               NULL, NULL, jsonb_build_object('reason', _reason, 'admin_id', auth.uid()));
  INSERT INTO public.monetization_audit_log (actor_id, action, target, new_value)
  VALUES (auth.uid(), 'wallet.adjust', _user::text, jsonb_build_object('amount', _amount, 'reason', _reason, 'ledger_id', v_row.id));
  RETURN v_row;
END;
$$;

-- Revenue summary for the admin dashboard (successful, non-refunded payments).
CREATE OR REPLACE FUNCTION public.admin_monetization_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'revenue', (
      SELECT COALESCE(jsonb_object_agg(currency, totals), '{}'::jsonb) FROM (
        SELECT currency, jsonb_build_object(
          'today', COALESCE(sum(amount_minor) FILTER (WHERE verified_at >= date_trunc('day', now())), 0),
          'last_7_days', COALESCE(sum(amount_minor) FILTER (WHERE verified_at >= now() - interval '7 days'), 0),
          'last_30_days', COALESCE(sum(amount_minor) FILTER (WHERE verified_at >= now() - interval '30 days'), 0),
          'total', COALESCE(sum(amount_minor), 0)
        ) AS totals
        FROM public.payment_transactions WHERE status = 'success' GROUP BY currency
      ) r
    ),
    'active_subscribers', (SELECT count(DISTINCT user_id) FROM public.user_subscriptions
                           WHERE status = 'active' AND now() >= starts_at AND now() < ends_at),
    'paying_users', (SELECT count(DISTINCT user_id) FROM public.payment_transactions WHERE status = 'success'),
    'payments_by_status', (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
                           FROM (SELECT status, count(*) n FROM public.payment_transactions GROUP BY status) s),
    'funnel_30d', (SELECT COALESCE(jsonb_object_agg(event, n), '{}'::jsonb)
                   FROM (SELECT event, count(DISTINCT user_id) n FROM public.monetization_events
                         WHERE created_at >= now() - interval '30 days' GROUP BY event) e)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions. Supabase grants EXECUTE on new functions to anon and
-- authenticated by default, so revoke explicitly and grant only what's needed.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
      'dating_today', 'dating_user_in_good_standing', 'dating_is_blocked', 'dating_current_plan',
      'dating_has_entitlement', 'dating_limit', 'get_my_dating_entitlements', 'log_monetization_event',
      'track_monetization_event', 'dating_react', 'dating_likes_received', 'dating_mark_likes_seen',
      'dating_my_matches', 'get_payment_options', 'payment_create_transaction', 'payment_attach_checkout',
      'payment_apply_result', 'payment_apply_refund', 'wallet_apply', 'monetization_audit_trigger',
      'protect_free_plan', 'admin_grant_subscription', 'admin_revoke_subscription', 'admin_wallet_adjust',
      'admin_monetization_summary'
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END
$$;

-- Signed-in users: only the user-facing entry points (each checks auth.uid()).
GRANT EXECUTE ON FUNCTION public.get_my_dating_entitlements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_monetization_event(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dating_react(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dating_likes_received(integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dating_mark_likes_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dating_my_matches(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_options() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_wallet_adjust(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_monetization_summary() TO authenticated;

-- Internal tables: no direct writes from the API (RLS has no write policies;
-- this also removes the default table grants).
REVOKE INSERT, UPDATE, DELETE ON public.dating_likes, public.dating_matches, public.user_subscriptions,
  public.feature_usage, public.monetization_events, public.payment_transactions, public.payment_webhook_events,
  public.payment_provider_logs, public.wallets, public.wallet_transactions, public.monetization_audit_log
  FROM anon, authenticated;
