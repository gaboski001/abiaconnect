
-- Exact-match composite for SubgroupDetail feed ORDER BY (is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC)
CREATE INDEX IF NOT EXISTS threads_subgroup_feed_idx
  ON public.threads (subgroup_id, is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC)
  WHERE subgroup_id IS NOT NULL;

-- Aggregation helpers
CREATE INDEX IF NOT EXISTS thread_votes_thread_idx ON public.thread_votes (thread_id);
CREATE INDEX IF NOT EXISTS threads_private_author_idx ON public.threads (private_author_id);

ANALYZE public.threads;
ANALYZE public.thread_votes;
ANALYZE public.replies;
