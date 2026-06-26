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
  v_retry_after int;
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
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM ((v_window + make_interval(secs => _window_seconds)) - now())))::int
    );
    RAISE EXCEPTION 'Rate limit exceeded: retry in % seconds (max % per % seconds)',
      v_retry_after, _max, _window_seconds
      USING ERRCODE = 'P0001',
            HINT = 'retry_after=' || v_retry_after;
  END IF;
END;
$$;