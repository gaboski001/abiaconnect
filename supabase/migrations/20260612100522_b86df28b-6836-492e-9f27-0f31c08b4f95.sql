
-- 1) Block anonymous callers from email enumeration via username
REVOKE EXECUTE ON FUNCTION public.resolve_username_to_email(text) FROM anon, PUBLIC;

-- 2) Tighten profiles SELECT: only the row owner or an admin can read full profile rows
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles selectable by owner or admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- Safe cross-user profile lookups (only non-sensitive columns)
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid, username text, display_name text, avatar_url text,
  bio text, role text, reputation integer, lga text,
  created_at timestamptz, is_banned boolean, is_deleted boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, username, display_name, avatar_url, bio, role, reputation, lga,
         created_at, is_banned, is_deleted
  FROM public.profiles
  WHERE id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- Public safe view (for fk-style embeds and direct queries)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true, security_barrier = true) AS
SELECT id, username, display_name, avatar_url, bio, role, reputation, lga,
       created_at, is_banned, is_deleted
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3) Mask author identity on anonymous threads
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS private_author_id uuid;

-- Hide the private column from app roles entirely
REVOKE SELECT (private_author_id), INSERT (private_author_id), UPDATE (private_author_id)
  ON public.threads FROM anon, authenticated;
GRANT  SELECT (private_author_id), INSERT (private_author_id), UPDATE (private_author_id)
  ON public.threads TO service_role;

-- Backfill from existing author_id
UPDATE public.threads
   SET private_author_id = author_id
 WHERE private_author_id IS NULL;

-- Trigger: keep private_author_id authoritative; null public author_id/user_id when anonymous
CREATE OR REPLACE FUNCTION public.threads_enforce_anonymity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.private_author_id := COALESCE(auth.uid(), NEW.author_id, NEW.user_id);
    IF NEW.is_anonymous THEN
      NEW.author_id := NULL;
      NEW.user_id   := NULL;
    ELSE
      NEW.author_id := NEW.private_author_id;
      NEW.user_id   := NEW.private_author_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- private_author_id is immutable
    NEW.private_author_id := OLD.private_author_id;
    IF NEW.is_anonymous THEN
      NEW.author_id := NULL;
      NEW.user_id   := NULL;
    ELSE
      NEW.author_id := OLD.private_author_id;
      NEW.user_id   := OLD.private_author_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Update RLS policies on threads to use private_author_id for owner checks
DROP POLICY IF EXISTS "Author or admin delete thread" ON public.threads;
DROP POLICY IF EXISTS "Author or admin update thread" ON public.threads;
DROP POLICY IF EXISTS "Users create threads" ON public.threads;

CREATE POLICY "Author or admin delete thread"
  ON public.threads FOR DELETE TO authenticated
  USING (auth.uid() = private_author_id OR public.is_admin(auth.uid()));

CREATE POLICY "Author or admin update thread"
  ON public.threads FOR UPDATE TO authenticated
  USING (auth.uid() = private_author_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = private_author_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users create threads"
  ON public.threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- SECURITY DEFINER helper so a user can list their own threads (including anonymous ones)
CREATE OR REPLACE FUNCTION public.my_thread_ids()
RETURNS TABLE(id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.threads WHERE private_author_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.my_thread_ids() TO authenticated;
