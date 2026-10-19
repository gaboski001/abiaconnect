-- Sub-topics of private groups are visible only to their members, the group's
-- creator and admins. Topics of public groups stay visible to everyone (they
-- are labels such as "Introduce yourself", not personal data).
DROP POLICY IF EXISTS "Topics are visible to everyone" ON public.subgroup_topics;
DROP POLICY IF EXISTS "Topics of public groups, or of private groups you belong to" ON public.subgroup_topics;
CREATE POLICY "Topics of public groups, or of private groups you belong to" ON public.subgroup_topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subgroups s
       WHERE s.id = subgroup_id
         AND (
           NOT s.is_private
           OR s.created_by = auth.uid()
           OR public.is_subgroup_member(s.id, auth.uid())
           OR public.is_admin(auth.uid())
         )
    )
  );
