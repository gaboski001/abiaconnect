-- Followers and Following lists, like Instagram.
--   member_follow_list()  anyone's followers or following (signed-in members,
--                         same visibility as their member page), with search and
--                         paging; each row says whether you follow them and
--                         whether they follow you.
--   remove_follower()     take someone out of your own followers.
--   my_following_ids()    everyone you follow (the app used to see only 50).

CREATE OR REPLACE FUNCTION public.member_follow_list(
  _user uuid, _kind text, _q text DEFAULT NULL, _limit int DEFAULT 30, _offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid, display_name text, username text, avatar_url text, headline text,
  followed_at timestamptz, i_follow boolean, follows_me boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_q text := btrim(COALESCE(_q, ''));
  v_like text;
BEGIN
  IF v_me IS NULL OR _kind NOT IN ('followers', 'following') OR NOT public.community_member_visible(_user) THEN
    RETURN;
  END IF;
  v_like := '%' || replace(replace(replace(left(v_q, 60), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN QUERY
  WITH people AS (
    SELECT f.follower_id AS uid, f.created_at AS at
      FROM public.connect_follows f
     WHERE _kind = 'followers' AND f.followed_id = _user
    UNION ALL
    SELECT f.followed_id, f.created_at
      FROM public.connect_follows f
     WHERE _kind = 'following' AND f.follower_id = _user
  )
  SELECT x.uid, p.display_name, p.username, p.avatar_url, rp.headline, x.at,
         EXISTS (SELECT 1 FROM public.connect_follows a WHERE a.follower_id = v_me AND a.followed_id = x.uid),
         EXISTS (SELECT 1 FROM public.connect_follows b WHERE b.follower_id = x.uid AND b.followed_id = v_me)
    FROM people x
    JOIN public.profiles p ON p.id = x.uid
    LEFT JOIN public.relationship_profiles rp ON rp.user_id = x.uid
   WHERE NOT p.is_banned
     AND NOT COALESCE(p.is_deleted, false)
     AND (x.uid = v_me OR NOT public.dating_is_blocked(x.uid, v_me))
     AND (v_q = '' OR p.display_name ILIKE v_like OR p.username ILIKE v_like)
   ORDER BY x.at DESC
   LIMIT LEAST(GREATEST(_limit, 1), 50) OFFSET GREATEST(_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_follower(_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  DELETE FROM public.connect_follows WHERE follower_id = _user AND followed_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_following_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(f.followed_id), '{}') FROM public.connect_follows f WHERE f.follower_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.member_follow_list(uuid, text, text, int, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_follower(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_following_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_follow_list(uuid, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_follower(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_following_ids() TO authenticated;

NOTIFY pgrst, 'reload schema';
