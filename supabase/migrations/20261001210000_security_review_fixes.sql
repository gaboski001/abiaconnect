-- =============================================================================
-- Security review of the "SECURITY DEFINER function executable" warnings.
-- Every function on the list was checked. Admin functions all verify the
-- caller is an admin; member functions all act only on the caller's own data.
-- Four real issues are fixed here; nothing else changes behaviour.
-- =============================================================================

-- 1. email_queue_dispatch() is only for the scheduled email job, yet anyone
--    (even signed out) could trigger it. The app never calls it.
DO $$
BEGIN
  IF to_regprocedure('public.email_queue_dispatch()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- 2. View counts could be inflated without limit, including on removed posts.
--    Now: removed posts are ignored and each device/account gets 60 counted
--    views a minute (extra calls are silently ignored, never an error).
CREATE OR REPLACE FUNCTION public.increment_thread_view(_thread_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.enforce_client_rate_limit('thread_view', 60, 60);
  EXCEPTION WHEN others THEN
    RETURN;
  END;
  UPDATE public.threads
     SET view_count = view_count + 1
   WHERE id = _thread_id AND NOT COALESCE(is_deleted, false);
END;
$$;
REVOKE ALL ON FUNCTION public.increment_thread_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_thread_view(uuid) TO anon, authenticated;

-- 3. is_subgroup_member(group, user) answered for ANY user, so anyone could
--    find out who belongs to a private group. Every security rule only asks
--    about the signed-in user, so answer only about yourself (site admins and
--    the group's owner may ask about anyone; server jobs are unaffected).
CREATE OR REPLACE FUNCTION public.is_subgroup_member(_subgroup_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subgroup_members
    WHERE subgroup_id = _subgroup_id AND user_id = _user_id
  )
  AND (
    _user_id = auth.uid()
    OR COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated')
    OR public.is_subgroup_admin(_subgroup_id, auth.uid())
  )
$$;

-- Same for the contest visibility helper (it also took any user id).
CREATE OR REPLACE FUNCTION public.can_view_contest(_contest uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (_uid = auth.uid() OR COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'))
    AND EXISTS (
    SELECT 1 FROM public.contests c
     LEFT JOIN public.subgroups g ON g.id = c.subgroup_id
     WHERE c.id = _contest AND _uid IS NOT NULL
       AND (
         c.created_by = _uid
         OR public.is_admin(_uid)
         OR (c.status = 'approved' AND (
               c.subgroup_id IS NULL
               OR NOT COALESCE(g.is_private, false)
               OR c.allow_code_voters
               OR public.is_subgroup_member(c.subgroup_id, _uid)))
       )
  )
$$;

-- 4. Deleted accounts still showed their name, photo, bio and LGA to
--    everyone. Show "Deleted member" instead (admins still see the original,
--    e.g. in moderation tools). Same columns as before, so the app is unchanged.
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid, username text, display_name text, avatar_url text,
  bio text, role text, reputation integer, lga text,
  created_at timestamptz, is_banned boolean, is_deleted boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         CASE WHEN hide THEN NULL ELSE p.username END,
         CASE WHEN hide THEN 'Deleted member' ELSE p.display_name END,
         CASE WHEN hide THEN NULL ELSE p.avatar_url END,
         CASE WHEN hide THEN NULL ELSE p.bio END,
         p.role, p.reputation,
         CASE WHEN hide THEN NULL ELSE p.lga END,
         p.created_at, p.is_banned, p.is_deleted
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT COALESCE(p.is_deleted, false) AND NOT COALESCE(public.is_admin(auth.uid()), false) AS hide
  ) h
  WHERE p.id = ANY(_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;
