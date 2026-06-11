
-- 1) Hide threads.author_id from anon/authenticated readers
REVOKE SELECT (author_id) ON public.threads FROM anon, authenticated;

-- 2) Tighten subgroup_members SELECT policy
DROP POLICY IF EXISTS "Members viewable by everyone" ON public.subgroup_members;

CREATE POLICY "Members of public subgroups viewable by authenticated"
ON public.subgroup_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subgroups s
    WHERE s.id = subgroup_members.subgroup_id
      AND s.is_private = false
  )
  OR EXISTS (
    SELECT 1 FROM public.subgroup_members sm2
    WHERE sm2.subgroup_id = subgroup_members.subgroup_id
      AND sm2.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);
