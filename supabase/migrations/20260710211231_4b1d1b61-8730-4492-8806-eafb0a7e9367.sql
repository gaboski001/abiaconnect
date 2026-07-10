CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
      OR NEW.reputation IS DISTINCT FROM OLD.reputation)
     AND NOT (public.has_role(auth.uid(), 'Admin'::app_role)
              OR public.has_role(auth.uid(), 'Super Admin'::app_role))
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$$;