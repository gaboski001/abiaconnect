
-- 1) PROFILES: revoke column-level access to email and dob from regular roles
REVOKE SELECT (email, dob) ON public.profiles FROM anon, authenticated;

-- 2) SITE SETTINGS: restrict public read of sensitive SMTP keys
DROP POLICY IF EXISTS "Site settings viewable by everyone" ON public.site_settings;
CREATE POLICY "Public site settings readable"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (key NOT LIKE 'smtp_%' OR public.is_admin(auth.uid()));

-- 3) THREADS: enforce author_id = auth.uid() on insert (trigger already does this; add WITH CHECK as defense-in-depth)
DROP POLICY IF EXISTS "Users create threads" ON public.threads;
CREATE POLICY "Users create threads"
  ON public.threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- 4) SUBGROUP AUDIT: remove user-writable policy, install trigger that writes audit
DROP POLICY IF EXISTS "Users can insert their own audit rows" ON public.subgroup_membership_audit;

CREATE OR REPLACE FUNCTION public.audit_subgroup_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subgroup_membership_audit (subgroup_id, user_id, action)
    VALUES (NEW.subgroup_id, NEW.user_id, 'joined');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.subgroup_membership_audit (subgroup_id, user_id, action)
    VALUES (OLD.subgroup_id, OLD.user_id, 'left');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_subgroup_membership_ins ON public.subgroup_members;
DROP TRIGGER IF EXISTS trg_audit_subgroup_membership_del ON public.subgroup_members;
CREATE TRIGGER trg_audit_subgroup_membership_ins
  AFTER INSERT ON public.subgroup_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_subgroup_membership();
CREATE TRIGGER trg_audit_subgroup_membership_del
  AFTER DELETE ON public.subgroup_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_subgroup_membership();

-- 5) Set search_path on pgmq helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;

-- 6) Admin helper rpc to list users (avoids needing email/dob column grants)
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT NULL,
  _ids uuid[] DEFAULT NULL,
  _limit integer DEFAULT 10,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  lga text,
  email text,
  dob date,
  reputation integer,
  role text,
  is_banned boolean,
  is_deleted boolean,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT p.* FROM public.profiles p
    WHERE (_ids IS NULL OR p.id = ANY(_ids))
      AND (
        _search IS NULL OR _search = '' OR
        p.display_name ILIKE '%'||_search||'%' OR
        p.username ILIKE '%'||_search||'%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS c FROM base)
  SELECT b.id, b.display_name, b.username, b.avatar_url, b.bio, b.lga,
         b.email, b.dob, b.reputation, b.role, b.is_banned, b.is_deleted,
         b.created_at, (SELECT c FROM counted)
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text, uuid[], integer, integer) TO authenticated;
