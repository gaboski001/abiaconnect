DROP POLICY IF EXISTS "Users create threads" ON public.threads;

CREATE POLICY "Users create threads"
  ON public.threads FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_pinned = false
    AND is_deleted = false
    AND upvotes = 0
    AND view_count = 0
    AND (private_author_id IS NULL OR private_author_id = auth.uid())
  );