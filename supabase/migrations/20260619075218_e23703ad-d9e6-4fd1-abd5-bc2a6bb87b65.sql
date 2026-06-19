
-- Fix 1: Replies INSERT must verify subgroup membership for private subgroup threads
DROP POLICY IF EXISTS "Users can insert replies under any parent" ON public.replies;
CREATE POLICY "Users can insert replies respecting subgroup privacy"
ON public.replies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = replies.thread_id
      AND (
        t.subgroup_id IS NULL
        OR public.is_subgroup_member(t.subgroup_id, auth.uid())
        OR public.is_admin(auth.uid())
      )
  )
);

-- Fix 2: Stop broadcasting sensitive profile fields via Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
