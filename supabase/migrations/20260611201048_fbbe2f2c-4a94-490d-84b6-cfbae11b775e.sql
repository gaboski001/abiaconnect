ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upvotes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS threads_is_pinned_idx ON public.threads (is_pinned) WHERE is_pinned = true;