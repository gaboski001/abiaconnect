CREATE OR REPLACE FUNCTION public.search_public_profiles(_term text, _limit int DEFAULT 15)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, display_name, avatar_url
  FROM public.profiles
  WHERE COALESCE(is_deleted, false) = false
    AND COALESCE(is_banned, false) = false
    AND (
      display_name ILIKE '%' || _term || '%'
      OR username ILIKE '%' || _term || '%'
    )
    AND (auth.uid() IS NULL OR id <> auth.uid())
  ORDER BY
    CASE WHEN lower(username) = lower(_term) THEN 0
         WHEN lower(display_name) = lower(_term) THEN 1
         ELSE 2 END,
    username NULLS LAST
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;

REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, int) TO authenticated;