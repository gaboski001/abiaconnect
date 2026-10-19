-- Group posts were invisible:
-- 1. threads.topic_id (added by the newcomer update) was missing from the
--    column permissions, so every group page that asks for it was refused,
--    and posting under a topic was refused too.
-- 2. Posts in PUBLIC groups could only be read by members, so newcomers and
--    people following an invite link saw an empty group. Private groups stay
--    members-only.

GRANT SELECT (topic_id) ON public.threads TO anon, authenticated;
GRANT INSERT (topic_id), UPDATE (topic_id) ON public.threads TO authenticated;

CREATE OR REPLACE FUNCTION public.is_public_subgroup(_subgroup_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subgroups
    WHERE id = _subgroup_id AND NOT is_private AND is_active
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_public_subgroup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_subgroup(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Threads viewable respecting subgroup privacy" ON public.threads;
CREATE POLICY "Threads viewable respecting subgroup privacy"
ON public.threads
FOR SELECT
USING (
  subgroup_id IS NULL
  OR public.is_public_subgroup(subgroup_id)
  OR public.is_subgroup_member(subgroup_id, auth.uid())
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Replies viewable respecting subgroup privacy" ON public.replies;
CREATE POLICY "Replies viewable respecting subgroup privacy"
ON public.replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = replies.thread_id
      AND (
        t.subgroup_id IS NULL
        OR public.is_public_subgroup(t.subgroup_id)
        OR public.is_subgroup_member(t.subgroup_id, auth.uid())
        OR public.is_admin(auth.uid())
      )
  )
);
