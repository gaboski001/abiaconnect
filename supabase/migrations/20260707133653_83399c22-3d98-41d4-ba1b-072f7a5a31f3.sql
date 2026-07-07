
CREATE OR REPLACE FUNCTION public.email_registration_status(_email text)
RETURNS TABLE(is_registered boolean, is_verified boolean)
LANGUAGE plpgsql
STABLE
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

  BEGIN
    PERFORM public.enforce_rate_limit('email_registration_status', 20, 60);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

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

GRANT EXECUTE ON FUNCTION public.email_registration_status(text) TO anon, authenticated;
