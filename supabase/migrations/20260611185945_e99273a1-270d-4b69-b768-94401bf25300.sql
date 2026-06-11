
-- 1. Achievements: restrict SELECT to owner or admins
DROP POLICY IF EXISTS "Authenticated users view achievements" ON public.achievements;
CREATE POLICY "Users view own achievements"
ON public.achievements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 2. Profiles: revoke column SELECT on sensitive fields
REVOKE SELECT (email, dob) ON public.profiles FROM anon, authenticated;

-- 3. Profiles: harden INSERT against role escalation
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND (role IS NULL OR role = 'Member')
  AND is_banned = false
  AND is_deleted = false
  AND COALESCE(reputation, 0) = 0
);

-- 4. Threads: mask user_id for anonymous threads using a private author_id column
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS author_id uuid;
UPDATE public.threads SET author_id = user_id WHERE author_id IS NULL AND user_id IS NOT NULL;

REVOKE SELECT (author_id) ON public.threads FROM anon, authenticated;
GRANT SELECT (author_id) ON public.threads TO service_role;

CREATE OR REPLACE FUNCTION public.threads_enforce_anonymity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := COALESCE(auth.uid(), NEW.user_id);
    IF NEW.is_anonymous THEN
      NEW.user_id := NULL;
    ELSE
      NEW.user_id := NEW.author_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- author_id is immutable
    NEW.author_id := OLD.author_id;
    IF NEW.is_anonymous THEN
      NEW.user_id := NULL;
    ELSIF NEW.user_id IS NULL THEN
      NEW.user_id := OLD.author_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS threads_enforce_anonymity_trg ON public.threads;
CREATE TRIGGER threads_enforce_anonymity_trg
BEFORE INSERT OR UPDATE ON public.threads
FOR EACH ROW EXECUTE FUNCTION public.threads_enforce_anonymity();

-- Update author-based policies to use author_id (so anonymous authors retain control)
DROP POLICY IF EXISTS "Author or admin delete thread" ON public.threads;
CREATE POLICY "Author or admin delete thread"
ON public.threads
FOR DELETE
TO authenticated
USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Author or admin update thread" ON public.threads;
CREATE POLICY "Author or admin update thread"
ON public.threads
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = author_id OR public.is_admin(auth.uid()));
