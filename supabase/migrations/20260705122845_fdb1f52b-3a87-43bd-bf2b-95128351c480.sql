
-- Fix 1: prevent users from modifying sensitive profile fields (role, is_banned, is_deleted, reputation)
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.role       := OLD.role;
  NEW.is_banned  := OLD.is_banned;
  NEW.is_deleted := OLD.is_deleted;
  NEW.reputation := OLD.reputation;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_sensitive_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_sensitive_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_profile_fields();

-- Tighten the self-update policy with an explicit WITH CHECK
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix 2: restrict SELECT on the app-releases storage bucket to admins or
-- objects that correspond to an active release row.
DROP POLICY IF EXISTS "authenticated can read app-releases" ON storage.objects;
CREATE POLICY "authenticated can read active app-releases"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'app-releases'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.app_releases r
      WHERE r.file_path = storage.objects.name
        AND r.is_active = true
    )
  )
);
