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
     AND NOT public.has_role(auth.uid(), 'admin')
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_privileged_profile_fields ON public.profiles;
CREATE TRIGGER protect_privileged_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_privileged_profile_changes();