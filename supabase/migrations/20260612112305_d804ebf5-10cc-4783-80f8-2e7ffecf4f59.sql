
DROP POLICY IF EXISTS "Threads viewable by everyone" ON public.threads;
CREATE POLICY "Threads viewable respecting subgroup privacy"
ON public.threads
FOR SELECT
USING (
  subgroup_id IS NULL
  OR public.is_subgroup_member(subgroup_id, auth.uid())
  OR public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Replies viewable by everyone" ON public.replies;
CREATE POLICY "Replies viewable respecting subgroup privacy"
ON public.replies
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = replies.thread_id
      AND (
        t.subgroup_id IS NULL
        OR public.is_subgroup_member(t.subgroup_id, auth.uid())
        OR public.is_admin(auth.uid())
      )
  )
);
