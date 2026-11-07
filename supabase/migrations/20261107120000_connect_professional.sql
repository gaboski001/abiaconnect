-- Connect for everyone: why each member is here (work, business, services,
-- friendship, dating), work details on the profile, followers, likes on
-- photos, search by name, and a member's public posts on their profile.

-- ---------------------------------------------------------------------------
-- Why a member is here, and their work details
-- ---------------------------------------------------------------------------
ALTER TABLE public.relationship_profiles DROP CONSTRAINT IF EXISTS relationship_profiles_looking_for_check;
ALTER TABLE public.relationship_profiles ADD CONSTRAINT relationship_profiles_looking_for_check
  CHECK (looking_for IS NULL OR looking_for IN (
    'work', 'hiring', 'networking', 'services', 'friendship', 'dating', 'serious', 'marriage'
  ));

ALTER TABLE public.relationship_profiles
  ADD COLUMN IF NOT EXISTS work_experience text CHECK (char_length(work_experience) <= 2000),
  ADD COLUMN IF NOT EXISTS business_name text CHECK (char_length(business_name) <= 120),
  ADD COLUMN IF NOT EXISTS services text CHECK (char_length(services) <= 1000);

CREATE INDEX IF NOT EXISTS relationship_profiles_looking_for_idx
  ON public.relationship_profiles (looking_for) WHERE is_active;

-- ---------------------------------------------------------------------------
-- Followers and photo likes. Members only reach these through the functions
-- below, so blocks, bans and private mode are checked every time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connect_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS connect_follows_followed_idx ON public.connect_follows (followed_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.connect_photo_likes (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  liker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, photo_url, liker_id),
  CHECK (owner_id <> liker_id)
);
CREATE INDEX IF NOT EXISTS connect_photo_likes_owner_idx ON public.connect_photo_likes (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS connect_photo_likes_liker_idx ON public.connect_photo_likes (liker_id);

ALTER TABLE public.connect_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_photo_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.connect_follows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.connect_photo_likes FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Who the signed-in member may see and act on
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connect_member_visible(_owner uuid)
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
        SELECT 1
        FROM public.relationship_profiles rp
        JOIN public.profiles p ON p.id = rp.user_id
        WHERE rp.user_id = _owner
          AND rp.is_active
          AND NOT p.is_banned
          AND NOT COALESCE(p.is_deleted, false)
          AND (NOT rp.incognito OR public.connections_profile_visible(_owner))
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.connect_account_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
  );
$$;

-- One alert per person per day, so unfollowing and following again can't spam.
CREATE OR REPLACE FUNCTION public.connect_notify(_owner uuid, _type text, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link text := '/relationship/' || auth.uid()::text;
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

-- ---------------------------------------------------------------------------
-- Follow
-- ---------------------------------------------------------------------------
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
    IF _target = v_uid OR NOT public.connect_member_visible(_target) THEN
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

-- ---------------------------------------------------------------------------
-- Like a photo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connect_toggle_photo_like(_owner uuid, _photo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_liked boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.connect_account_ok() THEN RETURN jsonb_build_object('status', 'account_restricted'); END IF;

  DELETE FROM public.connect_photo_likes
   WHERE owner_id = _owner AND photo_url = _photo AND liker_id = v_uid;
  IF FOUND THEN
    v_liked := false;
  ELSE
    IF _owner = v_uid OR NOT public.connect_member_visible(_owner) OR NOT EXISTS (
      SELECT 1 FROM public.relationship_profiles rp
      WHERE rp.user_id = _owner AND _photo = ANY (rp.photos)
    ) THEN
      RETURN jsonb_build_object('status', 'unavailable');
    END IF;
    INSERT INTO public.connect_photo_likes (owner_id, photo_url, liker_id) VALUES (_owner, _photo, v_uid);
    PERFORM public.connect_notify(_owner, 'connect_photo_like', 'liked your photo');
    v_liked := true;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'liked', v_liked,
    'likes', (SELECT count(*) FROM public.connect_photo_likes l WHERE l.owner_id = _owner AND l.photo_url = _photo)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Numbers shown on a profile. The names behind them are for the owner only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connect_profile_summary(_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.connect_member_visible(_user) THEN NULL ELSE jsonb_build_object(
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

CREATE OR REPLACE FUNCTION public.connect_my_people(_kind text, _limit int DEFAULT 30, _offset int DEFAULT 0)
RETURNS TABLE (
  user_id uuid, display_name text, username text, avatar_url text,
  headline text, looking_for text, photo_url text, happened_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH people AS (
    SELECT f.follower_id AS uid, NULL::text AS photo, f.created_at AS at
      FROM public.connect_follows f
     WHERE _kind = 'followers' AND f.followed_id = auth.uid()
    UNION ALL
    SELECT f.followed_id, NULL, f.created_at
      FROM public.connect_follows f
     WHERE _kind = 'following' AND f.follower_id = auth.uid()
    UNION ALL
    SELECT l.liker_id, l.photo_url, l.created_at
      FROM public.connect_photo_likes l
      JOIN public.relationship_profiles mine ON mine.user_id = l.owner_id AND l.photo_url = ANY (mine.photos)
     WHERE _kind = 'photo_likes' AND l.owner_id = auth.uid()
  )
  SELECT x.uid, p.display_name, p.username, p.avatar_url, rp.headline, rp.looking_for, x.photo, x.at
  FROM people x
  JOIN public.profiles p ON p.id = x.uid
  LEFT JOIN public.relationship_profiles rp ON rp.user_id = x.uid
  WHERE NOT p.is_banned
    AND NOT COALESCE(p.is_deleted, false)
    AND NOT public.dating_is_blocked(x.uid, auth.uid())
  ORDER BY x.at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 50) OFFSET GREATEST(_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Search Connect members by name
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connect_search(_q text)
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := btrim(COALESCE(_q, ''));
  v_like text;
BEGIN
  IF auth.uid() IS NULL OR char_length(v_q) < 2 THEN RETURN; END IF;
  v_like := replace(replace(replace(left(v_q, 60), '\', '\\'), '%', '\%'), '_', '\_');
  RETURN QUERY
    SELECT rp.user_id
    FROM public.relationship_profiles rp
    JOIN public.profiles p ON p.id = rp.user_id
    WHERE rp.user_id <> auth.uid()
      AND (p.display_name ILIKE '%' || v_like || '%' OR p.username ILIKE '%' || v_like || '%')
      AND public.connect_member_visible(rp.user_id)
    ORDER BY (p.display_name ILIKE v_like || '%') DESC, p.display_name
    LIMIT 30;
END;
$$;

-- ---------------------------------------------------------------------------
-- A member's public posts. Never anonymous posts or private-group posts.
-- ---------------------------------------------------------------------------
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
    AND public.connect_member_visible(_user)
    AND NOT t.is_deleted
    AND NOT t.is_anonymous
    AND (t.subgroup_id IS NULL OR public.is_public_subgroup(t.subgroup_id))
  ORDER BY t.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 30);
$$;

-- ---------------------------------------------------------------------------
-- Blocking someone also ends follows and photo likes, both ways
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connect_clear_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.connect_follows
   WHERE (follower_id = NEW.user_id AND followed_id = NEW.blocked_id)
      OR (follower_id = NEW.blocked_id AND followed_id = NEW.user_id);
  DELETE FROM public.connect_photo_likes
   WHERE (owner_id = NEW.user_id AND liker_id = NEW.blocked_id)
      OR (owner_id = NEW.blocked_id AND liker_id = NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connect_clear_on_block ON public.relationship_blocks;
CREATE TRIGGER connect_clear_on_block AFTER INSERT ON public.relationship_blocks
  FOR EACH ROW EXECUTE FUNCTION public.connect_clear_on_block();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.connect_notify(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_clear_on_block() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.connect_member_visible(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_account_ok() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_toggle_follow(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_toggle_photo_like(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_profile_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_my_people(text, int, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_search(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.connect_member_posts(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connect_member_visible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_account_ok() TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_toggle_follow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_toggle_photo_like(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_profile_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_my_people(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_search(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.connect_member_posts(uuid, int) TO authenticated;
