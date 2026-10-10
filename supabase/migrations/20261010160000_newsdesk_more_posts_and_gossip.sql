-- Newsdesk bot: several posts a day per forum, three runs a day, and a Gossip forum.
--
-- Before: one post per forum per day, at most 8 a day, one run at 07:30.
-- Now:
--   - each forum has its own number of bot posts a day (forum_limits; forums
--     not listed use default_forum_limit). Busy forums start with 3, the
--     others with 2. There is no overall daily limit any more
--     (max_posts_per_day is no longer used).
--   - the bot runs at 07:30, 12:30 and 17:30 Lagos time, adding at most one
--     post per forum each time, so every run brings the latest news.
--   - a new "Gossip" forum for entertainment and celebrity news. Its posts
--     wait for an admin's approval to begin with (they are about named
--     people); an admin can untick that in Admin -> Newsdesk Bot.

-- More than one post per forum per day.
DROP INDEX IF EXISTS public.newsdesk_posts_one_per_forum_per_day;
CREATE INDEX IF NOT EXISTS newsdesk_posts_day_forum_idx ON public.newsdesk_posts (run_date, category_id);

ALTER TABLE public.newsdesk_settings
  ADD COLUMN IF NOT EXISTS default_forum_limit integer NOT NULL DEFAULT 2 CHECK (default_forum_limit BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS forum_limits jsonb NOT NULL
    DEFAULT '{"general-discussion": 3, "politics-governance": 3, "culture-heritage": 3, "gossip": 3}'::jsonb;

-- The Gossip forum.
INSERT INTO public.categories (name, slug, description, icon, color, display_order, is_active)
SELECT 'Gossip', 'gossip',
       'Entertainment and celebrity talk: music, Nollywood, fashion and what public figures are saying and doing. Keep it fun, fair and respectful.',
       '🎤', '#7a1f5c',
       (SELECT coalesce(max(display_order), 0) + 1 FROM public.categories),
       true
 WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'gossip');

UPDATE public.newsdesk_settings
   SET review_slugs = array_append(review_slugs, 'gossip')
 WHERE NOT ('gossip' = ANY (review_slugs));

-- Three runs a day: 06:30, 11:30 and 16:30 UTC = 07:30, 12:30 and 17:30 Lagos.
DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-newsdesk';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'daily-newsdesk',
    '30 6,11,16 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-newsdesk',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );
END $$;
