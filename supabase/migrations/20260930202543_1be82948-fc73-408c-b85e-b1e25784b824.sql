-- Lock down SECURITY DEFINER functions found in the function audit.
-- Nothing is dropped and no data is changed; only who may call what.

-- ---------------------------------------------------------------------------
-- 1. resolve_username_to_email: any signed-in user could turn any public
--    username into that person's email address (email harvesting). It is not
--    called by the app or any edge function, so restrict it to the backend.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.resolve_username_to_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(text) TO service_role;

-- email_is_registered is also unused by the app; backend only.
REVOKE EXECUTE ON FUNCTION public.email_is_registered(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_is_registered(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Working rate limit for email_registration_status (used by the Register
--    page for anonymous visitors). The old code wrapped enforce_rate_limit in
--    EXCEPTION WHEN OTHERS THEN NULL, which swallowed "Not authenticated" for
--    anon callers AND the "Rate limit exceeded" error for everyone, so there
--    was no limit at all on checking which emails have accounts.
--    New limiter keys on the user id when signed in, otherwise on the client
--    IP from the request headers PostgREST exposes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_rate_limits (
  client_key   text        NOT NULL,
  scope        text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (client_key, scope, window_start)
);
-- Only reachable through the SECURITY DEFINER function below.
ALTER TABLE public.client_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_client_rate_limit(
  _scope text,
  _max int,
  _window_seconds int DEFAULT 60
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers json;
  v_key text;
  v_window timestamptz;
  v_count int;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_key := 'uid:' || auth.uid()::text;
  ELSE
    BEGIN
      v_headers := current_setting('request.headers', true)::json;
    EXCEPTION WHEN others THEN
      v_headers := NULL;
    END;
    v_key := 'ip:' || COALESCE(
      NULLIF(v_headers ->> 'cf-connecting-ip', ''),
      NULLIF(v_headers ->> 'x-real-ip', ''),
      NULLIF(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
      'unknown'
    );
  END IF;

  v_window := to_timestamp(
    (floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds)::double precision
  );

  -- Keep the table small: drop this client's expired windows.
  DELETE FROM public.client_rate_limits
   WHERE client_key = v_key AND window_start < now() - interval '1 day';

  INSERT INTO public.client_rate_limits AS r (client_key, scope, window_start, count)
  VALUES (v_key, _scope, v_window, 1)
  ON CONFLICT (client_key, scope, window_start)
  DO UPDATE SET count = r.count + 1
  RETURNING count INTO v_count;

  IF v_count > _max THEN
    RAISE EXCEPTION 'Rate limit exceeded, please try again shortly'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Internal helper: only other SECURITY DEFINER functions call it.
REVOKE EXECUTE ON FUNCTION public.enforce_client_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_client_rate_limit(text, int, int) TO service_role;

-- Same signature and result as before; only the rate limit changed.
CREATE OR REPLACE FUNCTION public.email_registration_status(_email text)
RETURNS TABLE(is_registered boolean, is_verified boolean)
LANGUAGE plpgsql
VOLATILE -- was STABLE; the rate limiter writes rows
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := lower(trim(_email));
  v_uid uuid;
  v_confirmed timestamptz;
BEGIN
  is_registered := false;
  is_verified := false;

  IF v_norm IS NULL OR v_norm = '' OR position('@' in v_norm) = 0 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- Errors propagate: callers over the limit get an error, not an answer.
  PERFORM public.enforce_client_rate_limit('email_registration_status', 20, 60);

  SELECT p.id INTO v_uid
  FROM public.profiles p
  WHERE lower(p.email) = v_norm
    AND COALESCE(p.is_deleted, false) = false
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  is_registered := true;

  SELECT u.email_confirmed_at INTO v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  is_verified := v_confirmed IS NOT NULL;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_registration_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_registration_status(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Maintenance jobs had no REVOKE, so the default PUBLIC grant let anyone
--    (including logged-out visitors) run them. Backend only.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.prune_email_short_links() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_email_short_links() TO service_role;
REVOKE EXECUTE ON FUNCTION public.prune_issue_report_contact_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_issue_report_contact_emails() TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Messaging RPCs had no grants, so anon inherited EXECUTE from PUBLIC.
--    They already check auth.uid() internally; this removes anon access
--    entirely. Signed-in users keep access.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'clear_conversation', 'delete_conversation', 'delete_message_for_everyone',
        'edit_message', 'forward_message', 'set_conversation_archived',
        'set_conversation_pinned'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER trigger functions are exposed as callable RPCs by
--    default. Triggers keep firing without EXECUTE (it is only checked at
--    CREATE TRIGGER time), so revoke it from API roles.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END
$$;