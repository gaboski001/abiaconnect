-- The new dashboard and forum: follow any member, follow a discussion, best
-- answers, trusted members, LGA of the month, invites and the jobs board.

ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS best_reply_id uuid REFERENCES public.replies(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Every member has a public page, with or without a Connect profile. Blocks,
-- bans and Connect's private mode still apply.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_member_visible(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _owner = auth.uid() OR (
      NOT public.dating_is_blocked(_owner, auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _owner AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.relationship_profiles rp
        WHERE rp.user_id = _owner AND rp.incognito AND NOT public.connections_profile_visible(_owner)
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.connect_notify(_owner uuid, _type text, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link text := '/member/' || auth.uid()::text;
  v_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = _owner AND n.type = _type AND n.link = v_link
      AND n.created_at > now() - interval '1 day'
  ) THEN
    RETURN;
  END IF;
  SELECT COALESCE(NULLIF(p.display_name, ''), p.username, 'A member') INTO v_name
    FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (_owner, _type, v_name || ' ' || _action, v_link);
END;
$$;

CREATE OR REPLACE FUNCTION public.connect_toggle_follow(_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_following boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.connect_account_ok() THEN RETURN jsonb_build_object('status', 'account_restricted'); END IF;

  DELETE FROM public.connect_follows WHERE follower_id = v_uid AND followed_id = _target;
  IF FOUND THEN
    v_following := false;
  ELSE
    IF _target = v_uid OR NOT public.community_member_visible(_target) THEN
      RETURN jsonb_build_object('status', 'unavailable');
    END IF;
    INSERT INTO public.connect_follows (follower_id, followed_id) VALUES (v_uid, _target);
    PERFORM public.connect_notify(_target, 'connect_follow', 'started following you');
    v_following := true;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'following', v_following,
    'followers', (SELECT count(*) FROM public.connect_follows f WHERE f.followed_id = _target)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.connect_profile_summary(_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.community_member_visible(_user) THEN NULL ELSE jsonb_build_object(
    'followers', (SELECT count(*) FROM public.connect_follows f WHERE f.followed_id = _user),
    'following', (SELECT count(*) FROM public.connect_follows f WHERE f.follower_id = _user),
    'is_following', EXISTS (
      SELECT 1 FROM public.connect_follows f WHERE f.follower_id = auth.uid() AND f.followed_id = _user
    ),
    'photo_likes', COALESCE((
      SELECT jsonb_object_agg(s.photo_url, jsonb_build_object('likes', s.likes, 'liked', s.liked))
      FROM (
        SELECT l.photo_url, count(*) AS likes, bool_or(l.liker_id = auth.uid()) AS liked
        FROM public.connect_photo_likes l
        WHERE l.owner_id = _user
        GROUP BY l.photo_url
      ) s
    ), '{}'::jsonb)
  ) END;
$$;

CREATE OR REPLACE FUNCTION public.connect_member_posts(_user uuid, _limit int DEFAULT 10)
RETURNS TABLE (id uuid, title text, created_at timestamptz, place text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.title, t.created_at, COALESCE(c.name, s.name), count(*) OVER ()
  FROM public.threads t
  LEFT JOIN public.categories c ON c.id = t.category_id
  LEFT JOIN public.subgroups s ON s.id = t.subgroup_id
  WHERE t.user_id = _user
    AND public.community_member_visible(_user)
    AND NOT t.is_deleted
    AND NOT t.is_anonymous
    AND (t.subgroup_id IS NULL OR public.is_public_subgroup(t.subgroup_id))
  ORDER BY t.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 30);
$$;

-- ---------------------------------------------------------------------------
-- A member's public page: the parts that aren't in get_public_profiles, and
-- their work details. Dating details stay on Connect.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_member_page(_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.community_member_visible(_user) THEN NULL ELSE jsonb_build_object(
    'occupation', p.occupation,
    'current_location', p.current_location,
    'has_connect', COALESCE(rp.is_active, false),
    'looking_for', CASE WHEN rp.is_active AND rp.looking_for IN ('work', 'hiring', 'networking', 'services', 'friendship') THEN rp.looking_for END,
    'photos', CASE WHEN rp.is_active AND rp.looking_for IN ('work', 'hiring', 'networking', 'services', 'friendship') THEN to_jsonb(rp.photos) ELSE '[]'::jsonb END,
    'headline', CASE WHEN rp.is_active AND rp.looking_for IN ('work', 'hiring', 'networking', 'services', 'friendship') THEN rp.headline END,
    'work_experience', CASE WHEN rp.is_active THEN rp.work_experience END,
    'business_name', CASE WHEN rp.is_active THEN rp.business_name END,
    'services', CASE WHEN rp.is_active THEN rp.services END,
    'badges', COALESCE((SELECT jsonb_agg(b.badge ORDER BY b.awarded_at) FROM public.member_badges b WHERE b.user_id = _user), '[]'::jsonb)
  ) END
  FROM public.profiles p
  LEFT JOIN public.relationship_profiles rp ON rp.user_id = p.id
  WHERE p.id = _user;
$$;

-- ---------------------------------------------------------------------------
-- Trusted members: businesses and professionals an admin has checked.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trusted_members (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trusted_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trusted_members FROM PUBLIC, anon, authenticated;

-- The level and trusted mark shown beside a name on posts.
CREATE OR REPLACE FUNCTION public.member_labels(_ids uuid[])
RETURNS TABLE (user_id uuid, level int, trusted boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         public.points_level(COALESCE(s.points, 0)),
         EXISTS (SELECT 1 FROM public.trusted_members t WHERE t.user_id = p.id)
  FROM public.profiles p
  LEFT JOIN public.member_stats s ON s.user_id = p.id
  WHERE p.id = ANY (_ids[1:100]);
$$;

CREATE OR REPLACE FUNCTION public.admin_set_trusted(_user uuid, _on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only.'; END IF;
  IF NOT _on THEN
    DELETE FROM public.trusted_members WHERE user_id = _user;
    RETURN;
  END IF;
  INSERT INTO public.trusted_members (user_id, added_by) VALUES (_user, auth.uid()) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (_user, 'reward', 'You are now a Trusted member of AbiaConnect ✓', '/member/' || _user::text);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_trusted()
RETURNS TABLE (user_id uuid, display_name text, username text, avatar_url text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only.'; END IF;
  RETURN QUERY
    SELECT t.user_id, p.display_name, p.username, p.avatar_url, t.created_at
    FROM public.trusted_members t
    JOIN public.profiles p ON p.id = t.user_id
    ORDER BY t.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Follow a discussion
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thread_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);
CREATE INDEX IF NOT EXISTS thread_follows_thread_idx ON public.thread_follows (thread_id);
ALTER TABLE public.thread_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.thread_follows FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.community_can_read_thread(_thread uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = _thread AND NOT t.is_deleted AND (
      t.subgroup_id IS NULL
      OR public.is_public_subgroup(t.subgroup_id)
      OR public.is_subgroup_member(t.subgroup_id, auth.uid())
      OR public.is_admin(auth.uid())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.toggle_thread_follow(_thread uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  DELETE FROM public.thread_follows WHERE user_id = v_uid AND thread_id = _thread;
  IF FOUND THEN RETURN false; END IF;
  IF NOT public.community_can_read_thread(_thread) THEN RAISE EXCEPTION 'This discussion is not available.'; END IF;
  INSERT INTO public.thread_follows (user_id, thread_id) VALUES (v_uid, _thread);
  RETURN true;
END;
$$;

-- What the discussion page needs to know. is_mine is only ever about the person
-- asking, so an anonymous post stays anonymous to everyone else.
CREATE OR REPLACE FUNCTION public.thread_community_state(_thread uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'best_reply_id', t.best_reply_id,
    'following', EXISTS (SELECT 1 FROM public.thread_follows f WHERE f.thread_id = t.id AND f.user_id = auth.uid()),
    'is_mine', t.private_author_id = auth.uid()
  )
  FROM public.threads t
  WHERE t.id = _thread AND public.community_can_read_thread(_thread);
$$;

-- ---------------------------------------------------------------------------
-- Best answer. The person who asked picks it, and the helper earns points.
-- ---------------------------------------------------------------------------
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
    WHEN 'best_answer' THEN 75     -- 3 best answers
    WHEN 'invite_first_post' THEN 90 -- 3 people
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.set_best_answer(_thread uuid, _reply uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_helper uuid;
  v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT t.title INTO v_title FROM public.threads t
   WHERE t.id = _thread AND t.private_author_id = v_uid AND NOT t.is_deleted;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the person who asked can choose the best answer.'; END IF;

  IF _reply IS NULL THEN
    UPDATE public.threads SET best_reply_id = NULL WHERE id = _thread;
    RETURN;
  END IF;

  SELECT r.user_id INTO v_helper FROM public.replies r
   WHERE r.id = _reply AND r.thread_id = _thread AND NOT r.is_hidden;
  IF v_helper IS NULL THEN RAISE EXCEPTION 'That reply is not available.'; END IF;
  IF v_helper = v_uid THEN RAISE EXCEPTION 'You can''t choose your own reply.'; END IF;

  UPDATE public.threads SET best_reply_id = _reply WHERE id = _thread;
  -- Points once per discussion for each helper, however often the choice changes.
  IF public.award_points(v_helper, 25, 'best_answer', _thread::text) > 0 THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (v_helper, 'reward', 'Your reply was chosen as the best answer on "' || left(v_title, 70) || '" 🎉', '/thread/' || _thread::text);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Alerts when a reply arrives: people following the discussion, and the writer
-- when the post is doing well. A follower gets one alert until they read it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_doing_well_note(_thread uuid, _what text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  v_message text;
BEGIN
  SELECT private_author_id, title INTO t FROM public.threads WHERE id = _thread;
  IF t.private_author_id IS NULL THEN RETURN; END IF;
  v_message := 'Your post is doing well 🎉 "' || left(t.title, 70) || '" now has ' || _what;
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = t.private_author_id AND n.type = 'post_doing_well' AND n.message = v_message
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (t.private_author_id, 'post_doing_well', v_message, '/thread/' || _thread::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.community_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_author uuid;
  v_link text := '/thread/' || NEW.thread_id::text;
  v_replies int;
BEGIN
  SELECT title, private_author_id INTO v_title, v_author FROM public.threads WHERE id = NEW.thread_id;

  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT f.user_id, 'thread_follow', 'New reply in a discussion you follow: "' || left(v_title, 70) || '"', v_link
    FROM public.thread_follows f
   WHERE f.thread_id = NEW.thread_id
     AND f.user_id IS DISTINCT FROM NEW.user_id
     AND f.user_id IS DISTINCT FROM v_author
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
       WHERE n.user_id = f.user_id AND n.type = 'thread_follow' AND n.link = v_link AND NOT n.is_read
     );

  SELECT count(*) INTO v_replies FROM public.replies r WHERE r.thread_id = NEW.thread_id AND NOT r.is_hidden;
  IF v_replies IN (5, 20, 50, 100) THEN
    PERFORM public.post_doing_well_note(NEW.thread_id, v_replies || ' replies');
  END IF;

  PERFORM public.invite_reward(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_on_thread_likes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.upvotes IN (5, 20, 50, 100) THEN
    PERFORM public.post_doing_well_note(NEW.id, NEW.upvotes || ' likes');
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Invite your people. Points only when the person invited joins in, so fake
-- sign-ups earn nothing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.member_invite_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.member_invites (
  invitee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz
);
CREATE INDEX IF NOT EXISTS member_invites_inviter_idx ON public.member_invites (inviter_id);
ALTER TABLE public.member_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_invite_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.member_invites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_invite()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  SELECT code INTO v_code FROM public.member_invite_codes WHERE user_id = v_uid;
  IF v_code IS NULL THEN
    v_code := left(md5(v_uid::text || clock_timestamp()::text || random()::text), 10);
    INSERT INTO public.member_invite_codes (user_id, code) VALUES (v_uid, v_code);
  END IF;
  RETURN jsonb_build_object(
    'code', v_code,
    'joined', (SELECT count(*) FROM public.member_invites i WHERE i.inviter_id = v_uid),
    'posted', (SELECT count(*) FROM public.member_invites i WHERE i.inviter_id = v_uid AND i.rewarded_at IS NOT NULL)
  );
END;
$$;

-- Only a new account can be claimed, once, and never by the person who invited.
CREATE OR REPLACE FUNCTION public.claim_invite(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inviter uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT c.user_id INTO v_inviter FROM public.member_invite_codes c WHERE c.code = _code;
  IF v_inviter IS NULL OR v_inviter = v_uid THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.created_at > now() - interval '7 days'
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.member_invites (invitee_id, inviter_id) VALUES (v_uid, v_inviter) ON CONFLICT DO NOTHING;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_reward(_member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter uuid;
BEGIN
  IF _member IS NULL THEN RETURN; END IF;
  UPDATE public.member_invites SET rewarded_at = now()
   WHERE invitee_id = _member AND rewarded_at IS NULL
   RETURNING inviter_id INTO v_inviter;
  IF v_inviter IS NULL THEN RETURN; END IF;
  IF public.award_points(v_inviter, 30, 'invite_first_post', _member::text) > 0 THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (v_inviter, 'reward', 'Someone you invited just made their first post. You earned 30 points 🎉', '/rewards');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_on_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invite_reward(NEW.private_author_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_on_reply ON public.replies;
CREATE TRIGGER community_on_reply AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.community_on_reply();
DROP TRIGGER IF EXISTS community_on_thread ON public.threads;
CREATE TRIGGER community_on_thread AFTER INSERT ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.community_on_thread();
DROP TRIGGER IF EXISTS community_on_thread_likes ON public.threads;
CREATE TRIGGER community_on_thread_likes AFTER UPDATE OF upvotes ON public.threads
  FOR EACH ROW WHEN (NEW.upvotes > OLD.upvotes) EXECUTE FUNCTION public.community_on_thread_likes();

-- ---------------------------------------------------------------------------
-- LGA of the month: helpful replies and new members since the 1st.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lga_of_the_month()
RETURNS TABLE (lga text, score bigint, replies bigint, best_answers bigint, new_members bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_start AS (
    SELECT (date_trunc('month', public.community_today()::timestamp) AT TIME ZONE 'Africa/Lagos') AS at
  ),
  members AS (
    SELECT p.id, p.lga, p.created_at FROM public.profiles p
    WHERE NULLIF(btrim(p.lga), '') IS NOT NULL AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
  ),
  tally AS (
    SELECT m.lga, 1 AS replies, 0 AS best_answers, 0 AS new_members
      FROM public.replies r
      JOIN members m ON m.id = r.user_id, month_start ms
     WHERE r.created_at >= ms.at AND NOT r.is_hidden
    UNION ALL
    SELECT m.lga, 0, 1, 0
      FROM public.threads t
      JOIN public.replies r ON r.id = t.best_reply_id
      JOIN members m ON m.id = r.user_id, month_start ms
     WHERE r.created_at >= ms.at AND NOT t.is_deleted
    UNION ALL
    SELECT m.lga, 0, 0, 1
      FROM members m, month_start ms
     WHERE m.created_at >= ms.at
  )
  SELECT x.lga,
         sum(x.replies + x.best_answers * 5 + x.new_members * 2)::bigint,
         sum(x.replies)::bigint, sum(x.best_answers)::bigint, sum(x.new_members)::bigint
  FROM tally x
  GROUP BY x.lga
  ORDER BY 2 DESC, 1
  LIMIT 3;
$$;

-- ---------------------------------------------------------------------------
-- Jobs and services board, built from Connect profiles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.opportunities_board(_kind text DEFAULT NULL, _lga text DEFAULT NULL, _limit int DEFAULT 40)
RETURNS TABLE (
  user_id uuid, display_name text, username text, avatar_url text, lga text, looking_for text,
  headline text, occupation text, business_name text, services text, work_experience text, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rp.user_id, p.display_name, p.username, p.avatar_url, COALESCE(rp.lga, p.lga), rp.looking_for,
         rp.headline, rp.occupation, rp.business_name, rp.services, rp.work_experience, rp.updated_at
  FROM public.relationship_profiles rp
  JOIN public.profiles p ON p.id = rp.user_id
  WHERE rp.looking_for IN ('work', 'hiring', 'networking', 'services')
    AND (_kind IS NULL OR rp.looking_for = _kind)
    AND (_lga IS NULL OR COALESCE(rp.lga, p.lga) = _lga)
    AND public.connect_member_visible(rp.user_id)
  ORDER BY rp.updated_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 60);
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.community_on_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_on_thread() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_on_thread_likes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_doing_well_note(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invite_reward(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_notify(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_member_visible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_member_page(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.community_can_read_thread(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_thread_follow(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.thread_community_state(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_best_answer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_trusted(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_trusted() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_invite() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.opportunities_board(text, text, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.member_labels(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lga_of_the_month() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_member_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_member_page(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_can_read_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_thread_follow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.thread_community_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_best_answer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_trusted(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_trusted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.opportunities_board(text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_labels(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lga_of_the_month() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
