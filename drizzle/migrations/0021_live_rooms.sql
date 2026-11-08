-- Live rooms: a member talks live to their group; others listen and can be
-- invited up to speak. Audio only in this first version.
--
--   - STARTS SWITCHED OFF and, once on, for testers only. Admins can always
--     use it, so they can try it before anyone else sees it.
--   - Who can host: Level 5 or a Premium/VIP plan, an account at least 30
--     days old, and a group they run (owner or champion) with a post in the
--     last 14 days. Admins can always host.
--   - Free-plan limits so the live service never runs past its free monthly
--     amount: few rooms at once, 60 minutes a room, a listener cap and a
--     monthly minutes budget. When the budget is used up, nobody can start.
--   - Host and moderators can invite to speak, send back, remove; only the
--     host names moderators, blocks from future rooms and ends the room.
--   - Three reports in one room alert the admins. Admins can end any room
--     and stop a member from hosting.
--   - Not recorded.
--
-- The live audio itself runs on the live service; the live-room function
-- checks these rules (by calling the functions below as the member) before
-- it hands out a pass to the room or applies a change there.

-- One row: the switch and the limits.
CREATE TABLE IF NOT EXISTS public.live_settings (
  id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled            boolean NOT NULL DEFAULT false,
  testers_only       boolean NOT NULL DEFAULT true,
  max_rooms_at_once  integer NOT NULL DEFAULT 2 CHECK (max_rooms_at_once BETWEEN 1 AND 50),
  room_minutes       integer NOT NULL DEFAULT 60 CHECK (room_minutes BETWEEN 10 AND 240),
  max_listeners      integer NOT NULL DEFAULT 50 CHECK (max_listeners BETWEEN 5 AND 1000),
  -- Minutes summed over everyone in rooms (one person for one minute = 1).
  -- Kept under the live service's free monthly amount.
  monthly_minutes    integer NOT NULL DEFAULT 4500 CHECK (monthly_minutes BETWEEN 0 AND 10000000),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.live_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.live_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_settings FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.live_testers (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_testers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_testers FROM PUBLIC, anon, authenticated;

-- Members an admin has stopped from hosting.
CREATE TABLE IF NOT EXISTS public.live_host_bans (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text,
  banned_by  uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_host_bans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_host_bans FROM PUBLIC, anon, authenticated;

-- People a host keeps out of their future rooms.
CREATE TABLE IF NOT EXISTS public.live_host_blocks (
  host_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_id, blocked_id)
);
ALTER TABLE public.live_host_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_host_blocks FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.live_rooms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subgroup_id         uuid,
  title               text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  kind                text NOT NULL DEFAULT 'audio' CHECK (kind IN ('audio')),
  status              text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  ends_at             timestamptz NOT NULL,
  ended_at            timestamptz,
  -- host, time_up, host_left, admin
  ended_reason        text,
  peak_listeners      integer NOT NULL DEFAULT 0,
  participant_minutes integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS live_rooms_live_idx ON public.live_rooms (started_at DESC) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS live_rooms_started_idx ON public.live_rooms (started_at);
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_rooms FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.live_room_people (
  room_id     uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'moderator', 'speaker', 'listener')),
  hand_raised boolean NOT NULL DEFAULT false,
  removed     boolean NOT NULL DEFAULT false,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
ALTER TABLE public.live_room_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_room_people FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.live_room_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  is_pinned  boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_room_comments_room_idx ON public.live_room_comments (room_id, created_at);
ALTER TABLE public.live_room_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_room_comments FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.live_room_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  reporter_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason           text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_room_reports_room_idx ON public.live_room_reports (room_id);
ALTER TABLE public.live_room_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_room_reports FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- checks

-- Can this member see and join rooms at all?
CREATE OR REPLACE FUNCTION public.live_allowed(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_admin(_uid)
    OR EXISTS (
      SELECT 1 FROM public.live_settings s
      WHERE s.enabled AND (NOT s.testers_only OR EXISTS (SELECT 1 FROM public.live_testers t WHERE t.user_id = _uid))
    )
  ) AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND (p.is_banned OR p.is_deleted))
$$;

-- Groups this member runs that had a post in the last 14 days.
CREATE OR REPLACE FUNCTION public.live_host_groups(_uid uuid)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name FROM public.subgroups g
  WHERE g.is_active
    AND (g.created_by = _uid OR EXISTS (SELECT 1 FROM public.group_champions c WHERE c.subgroup_id = g.id AND c.user_id = _uid))
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.subgroup_id = g.id AND NOT t.is_deleted AND t.created_at >= now() - interval '14 days'
    )
  ORDER BY g.name
$$;

-- Why this member cannot host, or NULL when they can.
CREATE OR REPLACE FUNCTION public.live_host_blocker(_uid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
BEGIN
  IF _uid IS NULL THEN RETURN 'sign_in'; END IF;
  IF NOT public.live_allowed(_uid) THEN RETURN 'off'; END IF;
  IF EXISTS (SELECT 1 FROM public.live_host_bans b WHERE b.user_id = _uid) THEN RETURN 'stopped'; END IF;
  IF public.is_admin(_uid) THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.dob IS NOT NULL AND p.dob > (current_date - interval '18 years')) THEN
    RETURN 'under_18';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid AND u.created_at > now() - interval '30 days') THEN
    RETURN 'too_new';
  END IF;
  SELECT COALESCE(ms.points, 0) INTO v_points FROM public.member_stats ms WHERE ms.user_id = _uid;
  IF public.points_level(COALESCE(v_points, 0)) < 5 AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions s JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.user_id = _uid AND s.status = 'active' AND now() >= s.starts_at AND now() < s.ends_at
      AND p.tier IN ('premium', 'vip')
  ) THEN
    RETURN 'level_or_plan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_host_groups(_uid)) THEN RETURN 'active_group'; END IF;
  RETURN NULL;
END;
$$;

-- Minutes used this month, summed over everyone in rooms.
CREATE OR REPLACE FUNCTION public.live_minutes_this_month()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(participant_minutes), 0)::integer FROM public.live_rooms
  WHERE started_at >= date_trunc('month', now())
$$;

-- Ends rooms whose time is up or whose host has been gone 5 minutes.
CREATE OR REPLACE FUNCTION public.live_tidy()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.live_rooms r
  SET status = 'ended', ended_at = now(),
      ended_reason = CASE WHEN now() >= r.ends_at THEN 'time_up' ELSE 'host_left' END
  WHERE r.status = 'live' AND (
    now() >= r.ends_at
    OR NOT EXISTS (
      SELECT 1 FROM public.live_room_people p
      WHERE p.room_id = r.id AND p.user_id = r.host_id AND p.last_seen > now() - interval '5 minutes'
    )
  );
$$;

-- People in the room right now (seen in the last 90 seconds), host included.
CREATE OR REPLACE FUNCTION public.live_present_count(_room_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.live_room_people
  WHERE room_id = _room_id AND NOT removed AND last_seen > now() - interval '90 seconds'
$$;

-- What the app needs to show or hide Live for this member.
CREATE OR REPLACE FUNCTION public.live_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.live_settings;
BEGIN
  SELECT * INTO s FROM public.live_settings;
  RETURN jsonb_build_object(
    'allowed', public.live_allowed(uid),
    'host_blocker', public.live_host_blocker(uid),
    'room_minutes', s.room_minutes,
    'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name))
      FROM public.live_host_groups(uid) g), '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------- rooms

CREATE OR REPLACE FUNCTION public.live_start_room(_title text, _subgroup_id uuid, _accept_rules boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.live_settings;
  v_blocker text;
  v_room uuid;
  v_title text := btrim(COALESCE(_title, ''));
BEGIN
  PERFORM public.live_tidy();
  v_blocker := public.live_host_blocker(uid);
  IF v_blocker IS NOT NULL THEN RAISE EXCEPTION 'cannot_host:%', v_blocker; END IF;
  IF NOT COALESCE(_accept_rules, false) THEN RAISE EXCEPTION 'accept_rules'; END IF;
  IF char_length(v_title) < 3 THEN RAISE EXCEPTION 'title_too_short'; END IF;
  IF _subgroup_id IS NULL THEN
    IF NOT public.is_admin(uid) THEN RAISE EXCEPTION 'pick_group'; END IF;
  ELSIF NOT public.is_admin(uid) AND NOT EXISTS (SELECT 1 FROM public.live_host_groups(uid) g WHERE g.id = _subgroup_id) THEN
    RAISE EXCEPTION 'pick_group';
  END IF;
  IF EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.host_id = uid AND r.status = 'live') THEN
    RAISE EXCEPTION 'already_live';
  END IF;

  SELECT * INTO s FROM public.live_settings;
  -- Lock so two hosts starting together cannot both take the last place.
  PERFORM 1 FROM public.live_settings FOR UPDATE;
  IF (SELECT count(*) FROM public.live_rooms r WHERE r.status = 'live') >= s.max_rooms_at_once THEN
    RAISE EXCEPTION 'busy';
  END IF;
  IF public.live_minutes_this_month() >= s.monthly_minutes THEN RAISE EXCEPTION 'month_used_up'; END IF;

  INSERT INTO public.live_rooms (host_id, subgroup_id, title, ends_at)
  VALUES (uid, _subgroup_id, left(v_title, 100), now() + make_interval(mins => s.room_minutes))
  RETURNING id INTO v_room;
  INSERT INTO public.live_room_people (room_id, user_id, role) VALUES (v_room, uid, 'host');

  -- Followers hear about it once Live is open to everyone.
  IF s.enabled AND NOT s.testers_only THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT f.follower_id, 'live',
      COALESCE(NULLIF((SELECT p.display_name FROM public.profiles p WHERE p.id = uid), ''), 'Someone you follow')
        || ' is live now: ' || left(v_title, 100),
      '/live/' || v_room
    FROM public.connect_follows f
    WHERE f.followed_id = uid
      AND NOT EXISTS (SELECT 1 FROM public.live_host_blocks b WHERE b.host_id = uid AND b.blocked_id = f.follower_id)
    LIMIT 1000;
  END IF;
  RETURN v_room;
END;
$$;

-- Enter a room, or come back to it. Returns this member's role there.
CREATE OR REPLACE FUNCTION public.live_join_room(_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.live_rooms;
  me public.live_room_people;
  v_present integer;
BEGIN
  IF NOT public.live_allowed(uid) THEN RAISE EXCEPTION 'off'; END IF;
  PERFORM public.live_tidy();
  SELECT * INTO r FROM public.live_rooms WHERE id = _room_id;
  IF NOT FOUND OR r.status <> 'live' THEN RAISE EXCEPTION 'ended'; END IF;
  IF EXISTS (SELECT 1 FROM public.live_host_blocks b WHERE b.host_id = r.host_id AND b.blocked_id = uid) THEN
    RAISE EXCEPTION 'removed';
  END IF;
  SELECT * INTO me FROM public.live_room_people WHERE room_id = _room_id AND user_id = uid;
  IF FOUND AND me.removed THEN RAISE EXCEPTION 'removed'; END IF;

  IF NOT FOUND OR me.last_seen <= now() - interval '90 seconds' THEN
    v_present := public.live_present_count(_room_id);
    IF v_present >= (SELECT max_listeners FROM public.live_settings) + 1 THEN RAISE EXCEPTION 'full'; END IF;
  END IF;

  INSERT INTO public.live_room_people AS p (room_id, user_id, role)
  VALUES (_room_id, uid, 'listener')
  ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen = now()
  RETURNING * INTO me;

  UPDATE public.live_rooms SET peak_listeners = GREATEST(peak_listeners, public.live_present_count(_room_id) - 1)
  WHERE id = _room_id;
  RETURN me.role;
END;
$$;

-- Called every minute by each person in the room. Counts the minute towards
-- the monthly budget and keeps the room open while the host is there.
CREATE OR REPLACE FUNCTION public.live_heartbeat(_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_prev timestamptz;
  v_role text;
  v_removed boolean;
  v_status text;
BEGIN
  UPDATE public.live_room_people p SET last_seen = now()
  FROM (SELECT last_seen FROM public.live_room_people WHERE room_id = _room_id AND user_id = uid FOR UPDATE) old
  WHERE p.room_id = _room_id AND p.user_id = uid AND NOT p.removed
  RETURNING old.last_seen, p.role INTO v_prev, v_role;
  IF v_prev IS NOT NULL AND v_prev <= now() - interval '50 seconds' THEN
    UPDATE public.live_rooms SET participant_minutes = participant_minutes + 1 WHERE id = _room_id AND status = 'live';
  END IF;
  PERFORM public.live_tidy();
  SELECT removed INTO v_removed FROM public.live_room_people WHERE room_id = _room_id AND user_id = uid;
  SELECT status INTO v_status FROM public.live_rooms WHERE id = _room_id;
  RETURN jsonb_build_object('status', COALESCE(v_status, 'ended'), 'role', v_role, 'removed', COALESCE(v_removed, false));
END;
$$;

CREATE OR REPLACE FUNCTION public.live_raise_hand(_room_id uuid, _up boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_room_people SET hand_raised = COALESCE(_up, false)
  WHERE room_id = _room_id AND user_id = auth.uid() AND role = 'listener' AND NOT removed;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_in_room'; END IF;
END;
$$;

-- The caller's role in a live room, or NULL. Admins count as host.
CREATE OR REPLACE FUNCTION public.live_role_of(_room_id uuid, _uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin(_uid) THEN 'host'
    ELSE (SELECT p.role FROM public.live_room_people p WHERE p.room_id = _room_id AND p.user_id = _uid AND NOT p.removed)
  END
  FROM public.live_rooms r WHERE r.id = _room_id AND r.status = 'live'
$$;

-- Invite on stage (speaker), send back (listener), or name or drop a
-- moderator. Host: all of these. Moderator: speaker and listener only.
CREATE OR REPLACE FUNCTION public.live_set_role(_room_id uuid, _user_id uuid, _role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_mine text := public.live_role_of(_room_id, uid);
  v_theirs text;
BEGIN
  IF _role NOT IN ('moderator', 'speaker', 'listener') THEN RAISE EXCEPTION 'bad_role'; END IF;
  IF v_mine IS NULL OR v_mine NOT IN ('host', 'moderator') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT role INTO v_theirs FROM public.live_room_people
  WHERE room_id = _room_id AND user_id = _user_id AND NOT removed FOR UPDATE;
  IF v_theirs IS NULL THEN RAISE EXCEPTION 'not_in_room'; END IF;
  IF v_theirs = 'host' THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF v_mine = 'moderator' AND (_role = 'moderator' OR v_theirs = 'moderator') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF v_theirs = _role THEN RETURN _role; END IF;

  -- Lock the room so two quick taps cannot pass the limits together.
  PERFORM 1 FROM public.live_rooms WHERE id = _room_id FOR UPDATE;
  IF _role = 'moderator' AND (SELECT count(*) FROM public.live_room_people
      WHERE room_id = _room_id AND role = 'moderator' AND NOT removed) >= 2 THEN
    RAISE EXCEPTION 'moderators_full';
  END IF;
  IF _role = 'speaker' AND (SELECT count(*) FROM public.live_room_people
      WHERE room_id = _room_id AND role = 'speaker' AND NOT removed) >= 4 THEN
    RAISE EXCEPTION 'stage_full';
  END IF;

  UPDATE public.live_room_people SET role = _role, hand_raised = false
  WHERE room_id = _room_id AND user_id = _user_id;
  RETURN _role;
END;
$$;

-- Remove someone from the room. Only the host can also keep them out of
-- the host's future rooms.
CREATE OR REPLACE FUNCTION public.live_remove_person(_room_id uuid, _user_id uuid, _block boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_mine text := public.live_role_of(_room_id, uid);
  v_theirs text;
  v_host uuid;
BEGIN
  IF v_mine IS NULL OR v_mine NOT IN ('host', 'moderator') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF COALESCE(_block, false) AND v_mine <> 'host' THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT role INTO v_theirs FROM public.live_room_people WHERE room_id = _room_id AND user_id = _user_id;
  IF v_theirs IS NULL THEN RAISE EXCEPTION 'not_in_room'; END IF;
  IF v_theirs = 'host' OR (v_mine = 'moderator' AND v_theirs = 'moderator') THEN RAISE EXCEPTION 'not_allowed'; END IF;

  UPDATE public.live_room_people SET removed = true, role = 'listener', hand_raised = false
  WHERE room_id = _room_id AND user_id = _user_id;
  IF COALESCE(_block, false) THEN
    SELECT host_id INTO v_host FROM public.live_rooms WHERE id = _room_id;
    INSERT INTO public.live_host_blocks (host_id, blocked_id) VALUES (v_host, _user_id) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_end_room(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_host uuid;
BEGIN
  SELECT host_id INTO v_host FROM public.live_rooms WHERE id = _room_id AND status = 'live' FOR UPDATE;
  IF v_host IS NULL THEN RETURN; END IF;
  IF uid IS DISTINCT FROM v_host AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE public.live_rooms
  SET status = 'ended', ended_at = now(), ended_reason = CASE WHEN uid = v_host THEN 'host' ELSE 'admin' END
  WHERE id = _room_id;
END;
$$;

-- ---------------------------------------------------------------- comments

CREATE OR REPLACE FUNCTION public.live_comment(_room_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_body text := btrim(COALESCE(_body, ''));
  v_id uuid;
BEGIN
  IF public.live_role_of(_room_id, uid) IS NULL THEN RAISE EXCEPTION 'not_in_room'; END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'empty'; END IF;
  IF EXISTS (SELECT 1 FROM public.live_room_comments c
      WHERE c.room_id = _room_id AND c.user_id = uid AND c.created_at > now() - interval '3 seconds') THEN
    RAISE EXCEPTION 'slow_down';
  END IF;
  INSERT INTO public.live_room_comments (room_id, user_id, body) VALUES (_room_id, uid, left(v_body, 300))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Host or moderator: pin (one at a time), unpin or delete a comment.
CREATE OR REPLACE FUNCTION public.live_moderate_comment(_comment_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room uuid;
BEGIN
  SELECT room_id INTO v_room FROM public.live_room_comments WHERE id = _comment_id;
  IF v_room IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF COALESCE(public.live_role_of(v_room, auth.uid()), '') NOT IN ('host', 'moderator') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _action = 'pin' THEN
    UPDATE public.live_room_comments SET is_pinned = (id = _comment_id) WHERE room_id = v_room AND (is_pinned OR id = _comment_id);
  ELSIF _action = 'unpin' THEN
    UPDATE public.live_room_comments SET is_pinned = false WHERE id = _comment_id;
  ELSIF _action = 'delete' THEN
    UPDATE public.live_room_comments SET is_deleted = true, is_pinned = false WHERE id = _comment_id;
  ELSE
    RAISE EXCEPTION 'bad_action';
  END IF;
END;
$$;

-- ---------------------------------------------------------------- reports

-- Report the room, or one person in it. The third person to report a room
-- alerts the admins.
CREATE OR REPLACE FUNCTION public.live_report(_room_id uuid, _user_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_reason text := btrim(COALESCE(_reason, ''));
  v_reporters integer;
  v_title text;
BEGIN
  IF NOT public.live_allowed(uid) THEN RAISE EXCEPTION 'off'; END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'empty'; END IF;
  SELECT title INTO v_title FROM public.live_rooms WHERE id = _room_id;
  IF v_title IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.live_room_reports r WHERE r.room_id = _room_id AND r.reporter_id = uid
      AND r.reported_user_id IS NOT DISTINCT FROM _user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.live_room_reports (room_id, reporter_id, reported_user_id, reason)
  VALUES (_room_id, uid, _user_id, left(v_reason, 500));

  SELECT count(DISTINCT reporter_id) INTO v_reporters FROM public.live_room_reports WHERE room_id = _room_id;
  IF v_reporters = 3 THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT DISTINCT ur.user_id, 'live_report', '3 members reported the live room "' || left(v_title, 80) || '"', '/admin/dashboard'
    FROM public.user_roles ur WHERE ur.role IN ('Admin', 'Super Admin');
  END IF;
END;
$$;

-- ---------------------------------------------------------------- reading

-- Rooms live now, newest first, for the Live page and the strip on home.
CREATE OR REPLACE FUNCTION public.live_rooms_now()
RETURNS TABLE (
  id uuid, title text, host_id uuid, host_name text, host_avatar text,
  subgroup_id uuid, group_name text, started_at timestamptz, ends_at timestamptz, listening integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.live_allowed(auth.uid()) THEN RETURN; END IF;
  PERFORM public.live_tidy();
  RETURN QUERY
  SELECT r.id, r.title, r.host_id, COALESCE(NULLIF(p.display_name, ''), p.username, 'Member'), p.avatar_url,
    r.subgroup_id, g.name, r.started_at, r.ends_at, public.live_present_count(r.id)
  FROM public.live_rooms r
  LEFT JOIN public.profiles p ON p.id = r.host_id
  LEFT JOIN public.subgroups g ON g.id = r.subgroup_id
  WHERE r.status = 'live'
    AND NOT EXISTS (SELECT 1 FROM public.live_host_blocks b WHERE b.host_id = r.host_id AND b.blocked_id = auth.uid())
  ORDER BY r.started_at DESC;
END;
$$;

-- One room with everyone in it, for the room screen.
CREATE OR REPLACE FUNCTION public.live_room_detail(_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v jsonb;
BEGIN
  IF NOT public.live_allowed(uid) THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'id', r.id, 'title', r.title, 'status', r.status, 'host_id', r.host_id,
    'subgroup_id', r.subgroup_id, 'group_name', g.name,
    'started_at', r.started_at, 'ends_at', r.ends_at, 'ended_at', r.ended_at, 'ended_reason', r.ended_reason,
    'peak_listeners', r.peak_listeners,
    'my_role', public.live_role_of(r.id, uid),
    'people', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', lp.user_id, 'role', lp.role, 'hand_raised', lp.hand_raised,
        'name', COALESCE(NULLIF(pr.display_name, ''), pr.username, 'Member'), 'avatar', pr.avatar_url
      ) ORDER BY lp.joined_at)
      FROM public.live_room_people lp LEFT JOIN public.profiles pr ON pr.id = lp.user_id
      WHERE lp.room_id = r.id AND NOT lp.removed AND (lp.role <> 'listener' OR lp.last_seen > now() - interval '90 seconds')
    ), '[]'::jsonb)
  ) INTO v
  FROM public.live_rooms r LEFT JOIN public.subgroups g ON g.id = r.subgroup_id
  WHERE r.id = _room_id;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.live_room_comments_list(_room_id uuid)
RETURNS TABLE (id uuid, user_id uuid, name text, avatar text, body text, is_pinned boolean, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.user_id, COALESCE(NULLIF(p.display_name, ''), p.username, 'Member'), p.avatar_url, c.body, c.is_pinned, c.created_at
  FROM public.live_room_comments c LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.room_id = _room_id AND NOT c.is_deleted AND public.live_allowed(auth.uid())
  ORDER BY c.created_at DESC
  LIMIT 100
$$;

-- ---------------------------------------------------------------- admin

CREATE OR REPLACE FUNCTION public.admin_live_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  PERFORM public.live_tidy();
  RETURN jsonb_build_object(
    'settings', (SELECT to_jsonb(s) FROM public.live_settings s),
    'minutes_this_month', public.live_minutes_this_month(),
    'testers', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', t.user_id,
        'name', COALESCE(NULLIF(p.display_name, ''), p.username, 'Member')) ORDER BY t.created_at)
      FROM public.live_testers t LEFT JOIN public.profiles p ON p.id = t.user_id), '[]'::jsonb),
    'stopped_hosts', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', b.user_id, 'reason', b.reason,
        'name', COALESCE(NULLIF(p.display_name, ''), p.username, 'Member')) ORDER BY b.created_at)
      FROM public.live_host_bans b LEFT JOIN public.profiles p ON p.id = b.user_id), '[]'::jsonb),
    'rooms', COALESCE((SELECT jsonb_agg(x ORDER BY x->>'started_at' DESC) FROM (
      SELECT jsonb_build_object('id', r.id, 'title', r.title, 'status', r.status, 'host_id', r.host_id,
        'host_name', COALESCE(NULLIF(p.display_name, ''), p.username, 'Member'),
        'started_at', r.started_at, 'ended_reason', r.ended_reason, 'peak_listeners', r.peak_listeners,
        'minutes', r.participant_minutes,
        'open_reports', (SELECT count(*) FROM public.live_room_reports rr WHERE rr.room_id = r.id AND rr.status = 'open')) AS x
      FROM public.live_rooms r LEFT JOIN public.profiles p ON p.id = r.host_id
      WHERE r.status = 'live' OR r.started_at > now() - interval '14 days'
         OR EXISTS (SELECT 1 FROM public.live_room_reports rr WHERE rr.room_id = r.id AND rr.status = 'open')
      LIMIT 100) q), '[]'::jsonb),
    'reports', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', rr.id, 'room_id', rr.room_id, 'room_title', r.title,
        'reason', rr.reason, 'created_at', rr.created_at,
        'reporter', COALESCE(NULLIF(a.display_name, ''), a.username, 'Member'),
        'reported_user_id', rr.reported_user_id,
        'reported', CASE WHEN rr.reported_user_id IS NULL THEN NULL ELSE COALESCE(NULLIF(b.display_name, ''), b.username, 'Member') END)
        ORDER BY rr.created_at DESC)
      FROM public.live_room_reports rr JOIN public.live_rooms r ON r.id = rr.room_id
      LEFT JOIN public.profiles a ON a.id = rr.reporter_id LEFT JOIN public.profiles b ON b.id = rr.reported_user_id
      WHERE rr.status = 'open'), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_settings(
  _enabled boolean, _testers_only boolean, _max_rooms_at_once integer,
  _room_minutes integer, _max_listeners integer, _monthly_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE public.live_settings SET
    enabled = COALESCE(_enabled, enabled),
    testers_only = COALESCE(_testers_only, testers_only),
    max_rooms_at_once = COALESCE(_max_rooms_at_once, max_rooms_at_once),
    room_minutes = COALESCE(_room_minutes, room_minutes),
    max_listeners = COALESCE(_max_listeners, max_listeners),
    monthly_minutes = COALESCE(_monthly_minutes, monthly_minutes),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_tester(_user_id uuid, _on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _on THEN
    INSERT INTO public.live_testers (user_id, added_by) VALUES (_user_id, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.live_testers WHERE user_id = _user_id;
  END IF;
END;
$$;

-- Stop (or allow again) a member from hosting. Stopping also ends their room.
CREATE OR REPLACE FUNCTION public.admin_live_stop_host(_user_id uuid, _on boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF _on THEN
    INSERT INTO public.live_host_bans (user_id, reason, banned_by) VALUES (_user_id, left(_reason, 300), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by;
    UPDATE public.live_rooms SET status = 'ended', ended_at = now(), ended_reason = 'admin'
    WHERE host_id = _user_id AND status = 'live';
  ELSE
    DELETE FROM public.live_host_bans WHERE user_id = _user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_close_reports(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  UPDATE public.live_room_reports SET status = 'done' WHERE room_id = _room_id AND status = 'open';
END;
$$;

-- ---------------------------------------------------------------- access

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'live_allowed(uuid)', 'live_host_groups(uuid)', 'live_host_blocker(uuid)', 'live_minutes_this_month()',
    'live_tidy()', 'live_present_count(uuid)', 'live_role_of(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'live_status()', 'live_start_room(text, uuid, boolean)', 'live_join_room(uuid)', 'live_heartbeat(uuid)',
    'live_raise_hand(uuid, boolean)', 'live_set_role(uuid, uuid, text)', 'live_remove_person(uuid, uuid, boolean)',
    'live_end_room(uuid)', 'live_comment(uuid, text)', 'live_moderate_comment(uuid, text)',
    'live_report(uuid, uuid, text)', 'live_rooms_now()', 'live_room_detail(uuid)', 'live_room_comments_list(uuid)',
    'admin_live_overview()', 'admin_live_settings(boolean, boolean, integer, integer, integer, integer)',
    'admin_live_tester(uuid, boolean)', 'admin_live_stop_host(uuid, boolean, text)', 'admin_live_close_reports(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- The room screen listens for changes to people and comments, then reloads
-- them through the functions above. These policies only let the change
-- notices reach members allowed to use Live.
GRANT SELECT ON public.live_room_people, public.live_room_comments, public.live_rooms TO authenticated;
CREATE POLICY "Live members see room people" ON public.live_room_people FOR SELECT TO authenticated
  USING (public.live_allowed(auth.uid()));
CREATE POLICY "Live members see room comments" ON public.live_room_comments FOR SELECT TO authenticated
  USING (public.live_allowed(auth.uid()) AND NOT is_deleted);
CREATE POLICY "Live members see rooms" ON public.live_rooms FOR SELECT TO authenticated
  USING (public.live_allowed(auth.uid()));
GRANT EXECUTE ON FUNCTION public.live_allowed(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_people, public.live_room_comments, public.live_rooms;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';