ALTER TABLE public.newsdesk_posts
  ADD COLUMN IF NOT EXISTS banner_title text,
  ADD COLUMN IF NOT EXISTS banner_url text;