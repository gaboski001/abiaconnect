-- =============================================================================
-- Forum engagement + secure contests
--
-- 1. Points: earned server-side only (triggers + RPCs), with daily caps so they
--    can't be farmed. Daily check-in with streaks, levels, badges, leaderboard.
--    profiles.reputation mirrors the point total (and can't be self-edited).
-- 2. Contests (elections / awards): admins publish directly; group owners
--    propose and an admin approves. Voters are members of the chosen group
--    and/or holders of one-time voter codes. One vote per account and per
--    code. Secret ballot: who voted is stored apart from what was voted, with
--    nothing linking the two. Results live or hidden until close, per contest.
-- Points are status only and are never linked to money (wallets).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.community_today()
RETURNS date LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Africa/Lagos')::date $$;

-- ---------------------------------------------------------------------------
-- Points
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'daily_checkin', 'streak_bonus', 'thread', 'reply', 'thread_upvoted', 'reply_upvoted',
    'poll_vote', 'contest_vote', 'thread_removed', 'admin_adjust'
  )),
  ref_id text NOT NULL DEFAULT '',
  day date NOT NULL DEFAULT public.community_today(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Each action can only ever pay out once.
  UNIQUE (user_id, reason, ref_id)
);
CREATE INDEX IF NOT EXISTS points_ledger_user_day_idx ON public.points_ledger (user_id, day);
CREATE INDEX IF NOT EXISTS points_ledger_day_idx ON public.points_ledger (day);
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their own points history" ON public.points_ledger;
CREATE POLICY "Members read their own points history" ON public.points_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.points_ledger FROM anon, authenticated;
REVOKE ALL ON public.points_ledger FROM anon;

CREATE TABLE IF NOT EXISTS public.member_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_checkin date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can see community stats" ON public.member_stats;
CREATE POLICY "Members can see community stats" ON public.member_stats
  FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_stats FROM anon, authenticated;
REVOKE ALL ON public.member_stats FROM anon;

CREATE TABLE IF NOT EXISTS public.member_badges (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge)
);
ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can see badges" ON public.member_badges;
CREATE POLICY "Members can see badges" ON public.member_badges
  FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_badges FROM anon, authenticated;
REVOKE ALL ON public.member_badges FROM anon;

-- Level 1..7 from points (thresholds mirrored in src/lib/engagement.ts).
CREATE OR REPLACE FUNCTION public.points_level(_points integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN _points >= 6000 THEN 7
    WHEN _points >= 3000 THEN 6
    WHEN _points >= 1500 THEN 5
    WHEN _points >= 700 THEN 4
    WHEN _points >= 300 THEN 3
    WHEN _points >= 100 THEN 2
    ELSE 1
  END
$$;

-- Most a member can earn per reason per day (NULL = no cap).
CREATE OR REPLACE FUNCTION public.points_daily_cap(_reason text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE _reason
    WHEN 'thread' THEN 45          -- 3 discussions
    WHEN 'reply' THEN 100          -- 20 replies
    WHEN 'thread_upvoted' THEN 40
    WHEN 'reply_upvoted' THEN 40
    WHEN 'poll_vote' THEN 20
    WHEN 'contest_vote' THEN 25
    ELSE NULL
  END
$$;

-- Guard: reputation only changes through award_points().
CREATE OR REPLACE FUNCTION public.guard_profile_reputation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.reputation IS DISTINCT FROM OLD.reputation
     AND COALESCE(current_setting('abia.points_write', true), '') <> 'on' THEN
    NEW.reputation := OLD.reputation;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_profile_reputation ON public.profiles;
CREATE TRIGGER guard_profile_reputation BEFORE UPDATE OF reputation ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_reputation();

CREATE OR REPLACE FUNCTION public.sync_reputation(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM set_config('abia.points_write', 'on', true);
  UPDATE public.profiles p
     SET reputation = COALESCE((SELECT s.points FROM public.member_stats s WHERE s.user_id = _user), 0)
   WHERE p.id = _user;
  PERFORM set_config('abia.points_write', 'off', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_reputation(uuid) FROM PUBLIC, anon, authenticated;

-- Badges (catalog mirrored in src/lib/engagement.ts). Notifies on new ones.
CREATE OR REPLACE FUNCTION public.check_badges(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.member_stats%ROWTYPE;
  b text;
  earned text[] := '{}';
BEGIN
  SELECT * INTO s FROM public.member_stats WHERE user_id = _user;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.points_ledger WHERE user_id = _user AND reason = 'thread') THEN
    earned := array_append(earned, 'first_post');
  END IF;
  IF (SELECT count(*) FROM public.points_ledger WHERE user_id = _user AND reason = 'reply') >= 10 THEN
    earned := array_append(earned, 'conversationalist');
  END IF;
  IF EXISTS (SELECT 1 FROM public.points_ledger WHERE user_id = _user AND reason IN ('poll_vote', 'contest_vote')) THEN
    earned := array_append(earned, 'civic_voice');
  END IF;
  IF (SELECT count(*) FROM public.points_ledger WHERE user_id = _user AND reason IN ('thread_upvoted', 'reply_upvoted')) >= 25 THEN
    earned := array_append(earned, 'appreciated');
  END IF;
  IF s.longest_streak >= 7 THEN earned := array_append(earned, 'streak_7'); END IF;
  IF s.longest_streak >= 30 THEN earned := array_append(earned, 'streak_30'); END IF;
  IF s.points >= 300 THEN earned := array_append(earned, 'rising_star'); END IF;
  IF s.points >= 1500 THEN earned := array_append(earned, 'influencer'); END IF;

  FOREACH b IN ARRAY earned LOOP
    INSERT INTO public.member_badges (user_id, badge) VALUES (_user, b) ON CONFLICT DO NOTHING;
    IF FOUND THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (_user, 'reward', 'You earned a new badge. See your rewards.', '/rewards');
    END IF;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_badges(uuid) FROM PUBLIC, anon, authenticated;

-- The ONLY way points are added or removed. Returns the amount applied.
CREATE OR REPLACE FUNCTION public.award_points(_user uuid, _amount integer, _reason text, _ref text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cap integer;
  used integer;
  applied integer := _amount;
  new_id bigint;
BEGIN
  IF _user IS NULL OR _amount = 0 THEN RETURN 0; END IF;
  -- Banned or deleted accounts don't earn.
  IF _amount > 0 AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _user AND (p.is_banned OR p.is_deleted)
  ) THEN
    RETURN 0;
  END IF;

  cap := public.points_daily_cap(_reason);
  IF _amount > 0 AND cap IS NOT NULL THEN
    SELECT COALESCE(sum(amount), 0) INTO used FROM public.points_ledger
     WHERE user_id = _user AND reason = _reason AND day = public.community_today();
    applied := LEAST(_amount, cap - used);
    IF applied <= 0 THEN RETURN 0; END IF;
  END IF;

  INSERT INTO public.points_ledger (user_id, amount, reason, ref_id)
  VALUES (_user, applied, _reason, COALESCE(_ref, ''))
  ON CONFLICT (user_id, reason, ref_id) DO NOTHING
  RETURNING id INTO new_id;
  IF new_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.member_stats AS m (user_id, points) VALUES (_user, GREATEST(applied, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET points = GREATEST(0, m.points + applied), updated_at = now();

  PERFORM public.sync_reputation(_user);
  PERFORM public.check_badges(_user);
  RETURN applied;
END $$;
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;

-- ---- earning triggers ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.points_on_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE author uuid := COALESCE(NEW.author_id, NEW.user_id);
BEGIN
  IF TG_OP = 'INSERT' AND NOT COALESCE(NEW.is_deleted, false) THEN
    PERFORM public.award_points(author, 15, 'thread', NEW.id::text);
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.is_deleted, false) AND NOT COALESCE(OLD.is_deleted, false) THEN
    -- Removed posts give their points back (only if they earned any).
    IF EXISTS (SELECT 1 FROM public.points_ledger WHERE user_id = author AND reason = 'thread' AND ref_id = NEW.id::text) THEN
      PERFORM public.award_points(author, -15, 'thread_removed', NEW.id::text);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS points_on_thread ON public.threads;
CREATE TRIGGER points_on_thread AFTER INSERT OR UPDATE OF is_deleted ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.points_on_thread();

CREATE OR REPLACE FUNCTION public.points_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 5, 'reply', NEW.id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS points_on_reply ON public.replies;
CREATE TRIGGER points_on_reply AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.points_on_reply();

CREATE OR REPLACE FUNCTION public.points_on_thread_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE author uuid;
BEGIN
  IF NEW.value <= 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(t.author_id, t.user_id) INTO author FROM public.threads t WHERE t.id = NEW.thread_id;
  IF author IS NULL OR author = NEW.user_id THEN RETURN NEW; END IF;
  -- One payout per voter per post, so un-voting and re-voting earns nothing.
  PERFORM public.award_points(author, 2, 'thread_upvoted', NEW.thread_id::text || ':' || NEW.user_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS points_on_thread_vote ON public.thread_votes;
CREATE TRIGGER points_on_thread_vote AFTER INSERT OR UPDATE OF value ON public.thread_votes
  FOR EACH ROW EXECUTE FUNCTION public.points_on_thread_vote();

CREATE OR REPLACE FUNCTION public.points_on_reply_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE author uuid;
BEGIN
  IF NEW.value <= 0 THEN RETURN NEW; END IF;
  SELECT r.user_id INTO author FROM public.replies r WHERE r.id = NEW.reply_id;
  IF author IS NULL OR author = NEW.user_id THEN RETURN NEW; END IF;
  PERFORM public.award_points(author, 2, 'reply_upvoted', NEW.reply_id::text || ':' || NEW.user_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS points_on_reply_vote ON public.reply_votes;
CREATE TRIGGER points_on_reply_vote AFTER INSERT OR UPDATE OF value ON public.reply_votes
  FOR EACH ROW EXECUTE FUNCTION public.points_on_reply_vote();

CREATE OR REPLACE FUNCTION public.points_on_poll_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.award_points(NEW.user_id, 2, 'poll_vote', NEW.poll_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS points_on_poll_vote ON public.poll_votes;
CREATE TRIGGER points_on_poll_vote AFTER INSERT ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.points_on_poll_vote();

REVOKE EXECUTE ON FUNCTION public.points_on_thread(), public.points_on_reply(),
  public.points_on_thread_vote(), public.points_on_reply_vote(), public.points_on_poll_vote()
  FROM PUBLIC, anon, authenticated;

-- ---- daily reward ----------------------------------------------------------
-- 10 points a day, +2 per consecutive day (max +12), +20 at 7 days and +100
-- at 30 days. Missing a day restarts the streak.
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := public.community_today();
  s public.member_stats%ROWTYPE;
  streak integer;
  base integer;
  bonus integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND (p.is_banned OR p.is_deleted)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  INSERT INTO public.member_stats (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.member_stats WHERE user_id = uid FOR UPDATE;

  IF s.last_checkin = today THEN
    RETURN jsonb_build_object('claimed', false, 'already_claimed', true,
      'streak', s.current_streak, 'points', s.points, 'earned', 0);
  END IF;

  streak := CASE WHEN s.last_checkin = today - 1 THEN s.current_streak + 1 ELSE 1 END;
  base := 10 + LEAST(streak - 1, 6) * 2;
  IF streak = 7 THEN bonus := 20; ELSIF streak = 30 THEN bonus := 100; END IF;

  UPDATE public.member_stats
     SET current_streak = streak,
         longest_streak = GREATEST(longest_streak, streak),
         last_checkin = today,
         updated_at = now()
   WHERE user_id = uid;

  PERFORM public.award_points(uid, base, 'daily_checkin', today::text);
  IF bonus > 0 THEN
    PERFORM public.award_points(uid, bonus, 'streak_bonus', today::text);
  END IF;

  SELECT * INTO s FROM public.member_stats WHERE user_id = uid;
  RETURN jsonb_build_object('claimed', true, 'already_claimed', false,
    'streak', s.current_streak, 'points', s.points, 'earned', base + bonus, 'bonus', bonus);
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;

-- Everything the Rewards screen needs, for the signed-in member.
CREATE OR REPLACE FUNCTION public.get_my_rewards()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.member_stats%ROWTYPE;
  today date := public.community_today();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO s FROM public.member_stats WHERE user_id = uid;
  RETURN jsonb_build_object(
    'points', COALESCE(s.points, 0),
    'level', public.points_level(COALESCE(s.points, 0)),
    'current_streak', CASE WHEN s.last_checkin >= today - 1 THEN COALESCE(s.current_streak, 0) ELSE 0 END,
    'longest_streak', COALESCE(s.longest_streak, 0),
    'claimed_today', COALESCE(s.last_checkin = today, false),
    'badges', COALESCE((SELECT jsonb_agg(jsonb_build_object('badge', b.badge, 'awarded_at', b.awarded_at) ORDER BY b.awarded_at)
                          FROM public.member_badges b WHERE b.user_id = uid), '[]'::jsonb),
    'today', COALESCE((SELECT jsonb_object_agg(reason, total) FROM (
                         SELECT reason, sum(amount) AS total FROM public.points_ledger
                          WHERE user_id = uid AND day = today GROUP BY reason) t), '{}'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(r ORDER BY (r->>'created_at') DESC) FROM (
                          SELECT jsonb_build_object('amount', amount, 'reason', reason, 'created_at', created_at) AS r
                            FROM public.points_ledger WHERE user_id = uid ORDER BY created_at DESC LIMIT 20) x), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.get_my_rewards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rewards() TO authenticated;

-- Leaderboard: 'week' (last 7 days), 'month' (last 30 days) or 'all'.
CREATE OR REPLACE FUNCTION public.get_leaderboard(_period text DEFAULT 'week', _limit integer DEFAULT 50)
RETURNS TABLE (rank bigint, user_id uuid, display_name text, username text, avatar_url text, points bigint, level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH totals AS (
    SELECT l.user_id, sum(l.amount)::bigint AS pts
      FROM public.points_ledger l
     WHERE _period IN ('week', 'month')
       AND l.day >= public.community_today() - CASE WHEN _period = 'week' THEN 6 ELSE 29 END
     GROUP BY l.user_id
    UNION ALL
    SELECT s.user_id, s.points::bigint FROM public.member_stats s WHERE _period = 'all'
  ),
  ranked AS (
    SELECT t.user_id, t.pts,
           rank() OVER (ORDER BY t.pts DESC) AS rnk
      FROM totals t
      JOIN public.profiles p ON p.id = t.user_id
     WHERE t.pts > 0 AND NOT p.is_banned AND NOT p.is_deleted
  )
  SELECT r.rnk, r.user_id, p.display_name, p.username, p.avatar_url, r.pts,
         public.points_level(COALESCE(s.points, 0))
    FROM ranked r
    JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN public.member_stats s ON s.user_id = r.user_id
   WHERE auth.uid() IS NOT NULL
   ORDER BY r.rnk, p.display_name
   LIMIT LEAST(GREATEST(_limit, 1), 100)
$$;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_rank(_period text DEFAULT 'week')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH totals AS (
    SELECT l.user_id, sum(l.amount)::bigint AS pts
      FROM public.points_ledger l
     WHERE _period IN ('week', 'month')
       AND l.day >= public.community_today() - CASE WHEN _period = 'week' THEN 6 ELSE 29 END
     GROUP BY l.user_id
    UNION ALL
    SELECT s.user_id, s.points::bigint FROM public.member_stats s WHERE _period = 'all'
  ),
  ranked AS (
    SELECT t.user_id, t.pts, rank() OVER (ORDER BY t.pts DESC) AS rnk
      FROM totals t JOIN public.profiles p ON p.id = t.user_id
     WHERE t.pts > 0 AND NOT p.is_banned AND NOT p.is_deleted
  )
  SELECT COALESCE(
    (SELECT jsonb_build_object('rank', rnk, 'points', pts) FROM ranked WHERE user_id = auth.uid()),
    jsonb_build_object('rank', NULL, 'points', 0))
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_rank(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rank(text) TO authenticated;

-- Starting balance from past activity so the leaderboard isn't empty at
-- launch (no daily caps for history; one-time, idempotent).
INSERT INTO public.points_ledger (user_id, amount, reason, ref_id, day, created_at)
SELECT COALESCE(t.author_id, t.user_id), 15, 'thread', t.id::text,
       (t.created_at AT TIME ZONE 'Africa/Lagos')::date, t.created_at
  FROM public.threads t
 WHERE COALESCE(t.author_id, t.user_id) IS NOT NULL AND NOT COALESCE(t.is_deleted, false)
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = COALESCE(t.author_id, t.user_id))
ON CONFLICT DO NOTHING;
INSERT INTO public.points_ledger (user_id, amount, reason, ref_id, day, created_at)
SELECT r.user_id, 5, 'reply', r.id::text, (r.created_at AT TIME ZONE 'Africa/Lagos')::date, r.created_at
  FROM public.replies r WHERE r.user_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id)
ON CONFLICT DO NOTHING;
INSERT INTO public.points_ledger (user_id, amount, reason, ref_id, day, created_at)
SELECT COALESCE(t.author_id, t.user_id), 2, 'thread_upvoted', v.thread_id::text || ':' || v.user_id::text,
       (v.created_at AT TIME ZONE 'Africa/Lagos')::date, v.created_at
  FROM public.thread_votes v JOIN public.threads t ON t.id = v.thread_id
 WHERE v.value > 0 AND COALESCE(t.author_id, t.user_id) IS NOT NULL AND COALESCE(t.author_id, t.user_id) <> v.user_id
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = COALESCE(t.author_id, t.user_id))
ON CONFLICT DO NOTHING;
INSERT INTO public.points_ledger (user_id, amount, reason, ref_id, day, created_at)
SELECT r.user_id, 2, 'reply_upvoted', v.reply_id::text || ':' || v.user_id::text,
       (v.created_at AT TIME ZONE 'Africa/Lagos')::date, v.created_at
  FROM public.reply_votes v JOIN public.replies r ON r.id = v.reply_id
 WHERE v.value > 0 AND r.user_id IS NOT NULL AND r.user_id <> v.user_id
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id)
ON CONFLICT DO NOTHING;
INSERT INTO public.points_ledger (user_id, amount, reason, ref_id, day, created_at)
SELECT v.user_id, 2, 'poll_vote', v.poll_id::text, (v.created_at AT TIME ZONE 'Africa/Lagos')::date, v.created_at
  FROM public.poll_votes v
 WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.user_id)
ON CONFLICT DO NOTHING;

INSERT INTO public.member_stats AS m (user_id, points)
SELECT l.user_id, GREATEST(sum(l.amount), 0) FROM public.points_ledger l
 WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.user_id)
 GROUP BY l.user_id
ON CONFLICT (user_id) DO UPDATE SET points = EXCLUDED.points, updated_at = now();

DO $$
DECLARE r record;
BEGIN
  PERFORM set_config('abia.points_write', 'on', true);
  UPDATE public.profiles p SET reputation = s.points FROM public.member_stats s WHERE s.user_id = p.id;
  PERFORM set_config('abia.points_write', 'off', true);
  -- Award badges silently for history (no notification flood at launch).
  FOR r IN SELECT user_id FROM public.member_stats LOOP
    INSERT INTO public.member_badges (user_id, badge)
    SELECT r.user_id, b FROM unnest(ARRAY[
      CASE WHEN EXISTS (SELECT 1 FROM public.points_ledger WHERE user_id = r.user_id AND reason = 'thread') THEN 'first_post' END,
      CASE WHEN (SELECT count(*) FROM public.points_ledger WHERE user_id = r.user_id AND reason = 'reply') >= 10 THEN 'conversationalist' END,
      CASE WHEN EXISTS (SELECT 1 FROM public.points_ledger WHERE user_id = r.user_id AND reason = 'poll_vote') THEN 'civic_voice' END,
      CASE WHEN (SELECT count(*) FROM public.points_ledger WHERE user_id = r.user_id AND reason IN ('thread_upvoted','reply_upvoted')) >= 25 THEN 'appreciated' END,
      CASE WHEN (SELECT points FROM public.member_stats WHERE user_id = r.user_id) >= 300 THEN 'rising_star' END,
      CASE WHEN (SELECT points FROM public.member_stats WHERE user_id = r.user_id) >= 1500 THEN 'influencer' END
    ]) AS b WHERE b IS NOT NULL
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Contests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 140),
  description text CHECK (description IS NULL OR char_length(description) <= 4000),
  subgroup_id uuid REFERENCES public.subgroups(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  allow_group_voters boolean NOT NULL DEFAULT false,
  allow_code_voters boolean NOT NULL DEFAULT false,
  results_visibility text NOT NULL DEFAULT 'after_close' CHECK (results_visibility IN ('live', 'after_close')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (allow_group_voters OR allow_code_voters),
  CHECK (NOT allow_group_voters OR subgroup_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS contests_status_idx ON public.contests (status, ends_at);

CREATE TABLE IF NOT EXISTS public.contest_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  bio text CHECK (bio IS NULL OR char_length(bio) <= 600),
  photo_url text CHECK (photo_url IS NULL OR char_length(photo_url) <= 1000),
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS contest_candidates_contest_idx ON public.contest_candidates (contest_id, position);

-- One-time voter codes: only a hash is stored; the code itself is shown to the
-- organiser once, when generated.
CREATE TABLE IF NOT EXISTS public.contest_voter_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, code_hash)
);

-- Secret ballot: ballots carry no voter, no time; voters carry no choice.
CREATE TABLE IF NOT EXISTS public.contest_ballots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.contest_candidates(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS contest_ballots_contest_idx ON public.contest_ballots (contest_id, candidate_id);

CREATE TABLE IF NOT EXISTS public.contest_voters (
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  voter_key text NOT NULL,        -- 'u:<user id>' and, when a code was used, 'c:<code id>'
  PRIMARY KEY (contest_id, voter_key)
);

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_voter_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_voters ENABLE ROW LEVEL SECURITY;

-- All writes go through the functions below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.contests, public.contest_candidates FROM anon, authenticated;
REVOKE ALL ON public.contest_voter_codes, public.contest_ballots, public.contest_voters FROM anon, authenticated;
REVOKE ALL ON public.contests, public.contest_candidates FROM anon;

CREATE OR REPLACE FUNCTION public.can_view_contest(_contest uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contests c
     LEFT JOIN public.subgroups g ON g.id = c.subgroup_id
     WHERE c.id = _contest AND _uid IS NOT NULL
       AND (
         c.created_by = _uid
         OR public.is_admin(_uid)
         OR (c.status = 'approved' AND (
               c.subgroup_id IS NULL
               OR NOT COALESCE(g.is_private, false)
               OR c.allow_code_voters
               OR public.is_subgroup_member(c.subgroup_id, _uid)))
       )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_contest(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_contest(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "View approved or own contests" ON public.contests;
CREATE POLICY "View approved or own contests" ON public.contests
  FOR SELECT TO authenticated USING (public.can_view_contest(id, auth.uid()));
DROP POLICY IF EXISTS "View candidates of visible contests" ON public.contest_candidates;
CREATE POLICY "View candidates of visible contests" ON public.contest_candidates
  FOR SELECT TO authenticated USING (public.can_view_contest(contest_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.contest_code_normalize(_code text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT upper(regexp_replace(COALESCE(_code, ''), '[^A-Za-z0-9]', '', 'g')) $$;

CREATE OR REPLACE FUNCTION public.contest_code_hash(_contest uuid, _code text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions
AS $$ SELECT encode(extensions.digest(_contest::text || ':' || public.contest_code_normalize(_code), 'sha256'), 'hex') $$;
REVOKE EXECUTE ON FUNCTION public.contest_code_hash(uuid, text) FROM PUBLIC, anon, authenticated;

-- Create a contest. Admins publish directly; a group owner's contest for their
-- group waits for admin approval.
CREATE OR REPLACE FUNCTION public.create_contest(
  _title text, _description text, _subgroup_id uuid,
  _allow_group_voters boolean, _allow_code_voters boolean,
  _results_visibility text, _starts_at timestamptz, _ends_at timestamptz,
  _candidates jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin boolean;
  new_id uuid;
  cand jsonb;
  pos integer := 0;
  n integer;
  admin_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND (p.is_banned OR p.is_deleted)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  admin := public.is_admin(uid);
  IF _subgroup_id IS NULL THEN
    IF NOT admin THEN RAISE EXCEPTION 'only_admins_or_group_owners'; END IF;
  ELSIF NOT public.is_subgroup_admin(_subgroup_id, uid) THEN
    RAISE EXCEPTION 'only_admins_or_group_owners';
  END IF;
  IF _ends_at <= now() THEN RAISE EXCEPTION 'ends_in_past'; END IF;
  n := COALESCE(jsonb_array_length(_candidates), 0);
  IF n < 2 OR n > 50 THEN RAISE EXCEPTION 'need_2_to_50_candidates'; END IF;

  INSERT INTO public.contests (title, description, subgroup_id, created_by, status,
    allow_group_voters, allow_code_voters, results_visibility, starts_at, ends_at,
    reviewed_by, reviewed_at)
  VALUES (btrim(_title), NULLIF(btrim(COALESCE(_description, '')), ''), _subgroup_id, uid,
    CASE WHEN admin THEN 'approved' ELSE 'pending' END,
    COALESCE(_allow_group_voters, false), COALESCE(_allow_code_voters, false),
    COALESCE(_results_visibility, 'after_close'), _starts_at, _ends_at,
    CASE WHEN admin THEN uid END, CASE WHEN admin THEN now() END)
  RETURNING id INTO new_id;

  FOR cand IN SELECT * FROM jsonb_array_elements(_candidates) LOOP
    INSERT INTO public.contest_candidates (contest_id, name, bio, photo_url, position)
    VALUES (new_id, btrim(cand->>'name'), NULLIF(btrim(COALESCE(cand->>'bio', '')), ''),
            NULLIF(btrim(COALESCE(cand->>'photo_url', '')), ''), pos);
    pos := pos + 1;
  END LOOP;

  IF NOT admin THEN
    FOR admin_id IN SELECT p.id FROM public.profiles p WHERE public.is_admin(p.id) LOOP
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (admin_id, 'contest', 'A new contest is waiting for your approval: ' || btrim(_title), '/contests?tab=review');
    END LOOP;
  END IF;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_contest(text, text, uuid, boolean, boolean, text, timestamptz, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contest(text, text, uuid, boolean, boolean, text, timestamptz, timestamptz, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_contest(_contest uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.contests%ROWTYPE;
BEGIN
  IF uid IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'admins_only'; END IF;
  SELECT * INTO c FROM public.contests WHERE id = _contest FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'already_reviewed'; END IF;
  UPDATE public.contests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = uid, reviewed_at = now(), review_note = NULLIF(btrim(COALESCE(_note, '')), '')
   WHERE id = _contest;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (c.created_by, 'contest',
          CASE WHEN _approve THEN 'Your contest was approved: ' || c.title
               ELSE 'Your contest was not approved: ' || c.title || COALESCE(' (' || NULLIF(btrim(COALESCE(_note, '')), '') || ')', '') END,
          '/contests/' || c.id);
  IF _approve AND c.allow_group_voters THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT m.user_id, 'contest', 'New vote in your group: ' || c.title, '/contests/' || c.id
      FROM public.subgroup_members m WHERE m.subgroup_id = c.subgroup_id AND m.user_id <> c.created_by;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_contest(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_contest(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_contest(_contest uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); c public.contests%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.contests WHERE id = _contest FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF uid IS NULL OR NOT (c.created_by = uid OR public.is_admin(uid)) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF c.status NOT IN ('pending', 'approved') OR c.ends_at <= now() THEN RAISE EXCEPTION 'cannot_cancel'; END IF;
  UPDATE public.contests SET status = 'cancelled' WHERE id = _contest;
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_contest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_contest(uuid) TO authenticated;

-- Generate one-time voter codes (shown once). Organiser or admin.
CREATE OR REPLACE FUNCTION public.generate_contest_codes(_contest uuid, _count integer)
RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.contests%ROWTYPE;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- no 0/O, 1/I/L
  raw bytea;
  code text;
  i integer;
  j integer;
  made integer := 0;
BEGIN
  SELECT * INTO c FROM public.contests WHERE id = _contest;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF uid IS NULL OR NOT (c.created_by = uid OR public.is_admin(uid)) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT c.allow_code_voters THEN RAISE EXCEPTION 'codes_not_enabled'; END IF;
  IF c.status IN ('rejected', 'cancelled') OR c.ends_at <= now() THEN RAISE EXCEPTION 'contest_closed'; END IF;
  IF _count < 1 OR _count > 500 THEN RAISE EXCEPTION 'count_1_to_500'; END IF;
  IF (SELECT count(*) FROM public.contest_voter_codes WHERE contest_id = _contest) + _count > 5000 THEN
    RAISE EXCEPTION 'too_many_codes';
  END IF;

  WHILE made < _count LOOP
    raw := extensions.gen_random_bytes(8);
    code := '';
    FOR j IN 0..7 LOOP
      code := code || substr(alphabet, (get_byte(raw, j) % length(alphabet)) + 1, 1);
    END LOOP;
    code := substr(code, 1, 4) || '-' || substr(code, 5, 4);
    BEGIN
      INSERT INTO public.contest_voter_codes (contest_id, code_hash)
      VALUES (_contest, public.contest_code_hash(_contest, code));
      made := made + 1;
      RETURN NEXT code;
    EXCEPTION WHEN unique_violation THEN
      -- Astronomically rare collision: just draw again.
      NULL;
    END;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_contest_codes(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_contest_codes(uuid, integer) TO authenticated;

-- Cast a vote. One per account, and each code works once.
CREATE OR REPLACE FUNCTION public.cast_contest_vote(_contest uuid, _candidate uuid, _code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.contests%ROWTYPE;
  group_ok boolean := false;
  code_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND (p.is_banned OR p.is_deleted)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO c FROM public.contests WHERE id = _contest;
  IF NOT FOUND OR c.status <> 'approved' THEN RAISE EXCEPTION 'not_found'; END IF;
  IF now() < c.starts_at THEN RAISE EXCEPTION 'not_started'; END IF;
  IF now() >= c.ends_at THEN RAISE EXCEPTION 'voting_closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_candidates WHERE id = _candidate AND contest_id = _contest) THEN
    RAISE EXCEPTION 'invalid_candidate';
  END IF;

  group_ok := c.allow_group_voters AND public.is_subgroup_member(c.subgroup_id, uid);
  IF NOT group_ok THEN
    IF NOT c.allow_code_voters THEN RAISE EXCEPTION 'not_eligible'; END IF;
    IF public.contest_code_normalize(_code) = '' THEN RAISE EXCEPTION 'code_required'; END IF;
    SELECT id INTO code_id FROM public.contest_voter_codes
     WHERE contest_id = _contest AND code_hash = public.contest_code_hash(_contest, _code) AND used_at IS NULL
     FOR UPDATE;
    IF code_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  END IF;

  BEGIN
    INSERT INTO public.contest_voters (contest_id, voter_key) VALUES (_contest, 'u:' || uid::text);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_voted';
  END;
  IF code_id IS NOT NULL THEN
    UPDATE public.contest_voter_codes SET used_at = now() WHERE id = code_id;
    INSERT INTO public.contest_voters (contest_id, voter_key) VALUES (_contest, 'c:' || code_id::text);
  END IF;
  INSERT INTO public.contest_ballots (contest_id, candidate_id) VALUES (_contest, _candidate);

  PERFORM public.award_points(uid, 5, 'contest_vote', _contest::text);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.cast_contest_vote(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_contest_vote(uuid, uuid, text) TO authenticated;

-- One contest with candidates, the caller's voting status, turnout and, when
-- allowed, results.
CREATE OR REPLACE FUNCTION public.get_contest(_contest uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.contests%ROWTYPE;
  phase text;
  show_results boolean;
  is_manager boolean;
BEGIN
  IF NOT public.can_view_contest(_contest, uid) THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO c FROM public.contests WHERE id = _contest;
  phase := CASE
    WHEN c.status <> 'approved' THEN c.status
    WHEN now() < c.starts_at THEN 'upcoming'
    WHEN now() < c.ends_at THEN 'open'
    ELSE 'closed' END;
  show_results := c.status = 'approved' AND (c.results_visibility = 'live' AND now() >= c.starts_at OR now() >= c.ends_at);
  is_manager := c.created_by = uid OR public.is_admin(uid);

  RETURN jsonb_build_object(
    'id', c.id, 'title', c.title, 'description', c.description,
    'subgroup_id', c.subgroup_id,
    'subgroup_name', (SELECT g.name FROM public.subgroups g WHERE g.id = c.subgroup_id),
    'status', c.status, 'phase', phase,
    'allow_group_voters', c.allow_group_voters, 'allow_code_voters', c.allow_code_voters,
    'results_visibility', c.results_visibility,
    'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'review_note', CASE WHEN is_manager THEN c.review_note END,
    'is_manager', is_manager,
    'candidates', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'bio', k.bio, 'photo_url', k.photo_url) ORDER BY k.position)
                            FROM public.contest_candidates k WHERE k.contest_id = c.id), '[]'::jsonb),
    'has_voted', EXISTS (SELECT 1 FROM public.contest_voters v WHERE v.contest_id = c.id AND v.voter_key = 'u:' || uid::text),
    'eligible_by_group', c.allow_group_voters AND public.is_subgroup_member(c.subgroup_id, uid),
    'turnout', (SELECT count(*) FROM public.contest_voters v WHERE v.contest_id = c.id AND v.voter_key LIKE 'u:%'),
    'results', CASE WHEN show_results THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('candidate_id', k.id, 'votes',
                 (SELECT count(*) FROM public.contest_ballots b WHERE b.contest_id = c.id AND b.candidate_id = k.id)) ORDER BY k.position)
          FROM public.contest_candidates k WHERE k.contest_id = c.id), '[]'::jsonb) END,
    'codes', CASE WHEN is_manager AND c.allow_code_voters THEN jsonb_build_object(
        'total', (SELECT count(*) FROM public.contest_voter_codes x WHERE x.contest_id = c.id),
        'used', (SELECT count(*) FROM public.contest_voter_codes x WHERE x.contest_id = c.id AND x.used_at IS NOT NULL)) END
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.get_contest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contest(uuid) TO authenticated;

-- Live "+points" toasts and contest lists update in real time.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.points_ledger;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
