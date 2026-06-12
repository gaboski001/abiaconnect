
-- Add FK so PostgREST can embed profiles on threads
ALTER TABLE public.threads
  ADD CONSTRAINT threads_author_id_profiles_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS threads_created_at_idx ON public.threads (created_at DESC);
CREATE INDEX IF NOT EXISTS threads_category_created_idx ON public.threads (category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS threads_author_id_idx ON public.threads (author_id);
CREATE INDEX IF NOT EXISTS replies_thread_id_idx ON public.replies (thread_id);
