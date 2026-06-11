
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.thread_votes RENAME COLUMN vote_type TO value;

ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
ALTER TABLE public.polls
  ADD CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by)
  REFERENCES public.profiles(id) ON DELETE SET NULL;
