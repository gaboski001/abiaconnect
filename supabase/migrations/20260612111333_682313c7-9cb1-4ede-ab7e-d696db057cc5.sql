
CREATE INDEX IF NOT EXISTS threads_subgroup_created_idx
  ON public.threads (subgroup_id, created_at DESC)
  WHERE subgroup_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS replies_thread_created_idx
  ON public.replies (thread_id, created_at DESC);
