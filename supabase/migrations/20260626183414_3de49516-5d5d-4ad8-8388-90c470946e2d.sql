-- 1) Counter table
CREATE TABLE IF NOT EXISTS public.search_rate_limits (
  user_id uuid NOT NULL,
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, scope, window_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_rate_limits TO authenticated;
GRANT ALL ON public.search_rate_limits TO service_role;

ALTER TABLE public.search_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own counters (useful for client UX), nothing else.
CREATE POLICY "Users read own rate limits"
  ON public.search_rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE policies: only the SECURITY DEFINER function
-- below mutates this table.

CREATE INDEX IF NOT EXISTS search_rate_limits_window_idx
  ON public.search_rate_limits (window_start);

-- 2) Enforcement helper
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  _scope text,
  _max int,
  _window_seconds int DEFAULT 60
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_window timestamptz;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  v_window := to_timestamp(
    (floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds)::double precision
  );

  INSERT INTO public.search_rate_limits AS r (user_id, scope, window_start, count)
  VALUES (v_uid, _scope, v_window, 1)
  ON CONFLICT (user_id, scope, window_start)
  DO UPDATE SET count = r.count + 1
  RETURNING count INTO v_count;

  IF v_count > _max THEN
    RAISE EXCEPTION 'Rate limit exceeded: max % requests per % seconds', _max, _window_seconds
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_rate_limit(text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, int, int) TO authenticated;

-- 3) Rebuild search_public_profiles to enforce the limit
CREATE OR REPLACE FUNCTION public.search_public_profiles(_term text, _limit int DEFAULT 15)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 30 searches per 60-second window per user
  PERFORM public.enforce_rate_limit('search_public_profiles', 30, 60);

  RETURN QUERY
  SELECT p.id, p.username, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE COALESCE(p.is_deleted, false) = false
    AND COALESCE(p.is_banned, false) = false
    AND (
      p.display_name ILIKE '%' || _term || '%'
      OR p.username ILIKE '%' || _term || '%'
    )
    AND (auth.uid() IS NULL OR p.id <> auth.uid())
  ORDER BY
    CASE WHEN lower(p.username) = lower(_term) THEN 0
         WHEN lower(p.display_name) = lower(_term) THEN 1
         ELSE 2 END,
    p.username NULLS LAST
  LIMIT GREATEST(1, LEAST(_limit, 50));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_public_profiles(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, int) TO authenticated;

-- 4) Housekeeping: prune counter rows older than 1 day on each call
CREATE OR REPLACE FUNCTION public.prune_search_rate_limits()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.search_rate_limits
  WHERE window_start < now() - interval '1 day';
$$;
REVOKE EXECUTE ON FUNCTION public.prune_search_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_search_rate_limits() TO service_role;