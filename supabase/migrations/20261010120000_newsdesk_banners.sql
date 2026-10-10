-- Newsdesk bot: every post gets its own banner (the post's headline on its
-- forum's photo, in the style of the October 2026 thumbnails). The
-- newsdesk-banner edge function draws it and keeps it in the public
-- "newsdesk" storage bucket, which the function creates if it is missing.
--   banner_title  the short headline written on the picture
--   banner_url    where the finished picture is (NULL = none; the post then
--                 uses its forum's picture)

ALTER TABLE public.newsdesk_posts
  ADD COLUMN IF NOT EXISTS banner_title text,
  ADD COLUMN IF NOT EXISTS banner_url text;
