
CREATE OR REPLACE FUNCTION public.email_is_registered(_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_norm text := lower(trim(_email));
BEGIN
  IF v_norm IS NULL OR v_norm = '' OR position('@' in v_norm) = 0 THEN
    RETURN false;
  END IF;
  -- Light rate limit to deter enumeration (anon uses NULL uid path).
  BEGIN
    PERFORM public.enforce_rate_limit('email_is_registered', 20, 60);
  EXCEPTION WHEN OTHERS THEN
    -- Anonymous callers have no auth.uid(); skip limiter gracefully.
    NULL;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(email) = v_norm
      AND COALESCE(is_deleted, false) = false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.email_is_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_is_registered(text) TO anon, authenticated;
