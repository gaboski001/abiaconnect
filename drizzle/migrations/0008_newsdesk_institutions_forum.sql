-- Newsdesk bot: an "Institutions" forum for news from universities,
-- polytechnics and colleges in Abia State.
--
-- The bot fills it from two places:
--   - the institutions' own websites. Most have no news feed, so the bot reads
--     the page and remembers its links here (newsdesk_seen_links); a link that
--     appears later is a new notice. The first reading of a page is only the
--     starting point (baseline = true): old notices are not posted as news.
--   - what trusted newspapers report about the institutions.
-- Up to 3 posts a day, published by themselves unless a story looks sensitive.

INSERT INTO public.categories (name, slug, description, icon, color, display_order, is_active)
SELECT 'Institutions', 'institutions',
       'Latest updates from universities, polytechnics and colleges in Abia State: admissions, fees, resumption and exam dates, accreditation, events and achievements.',
       '🎓', '#1f4e79',
       (SELECT coalesce(max(display_order), 0) + 1 FROM public.categories),
       true
 WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'institutions');

UPDATE public.newsdesk_settings
   SET forum_limits = forum_limits || '{"institutions": 3}'::jsonb
 WHERE NOT (forum_limits ? 'institutions');

-- Links the bot has seen on institutions' pages (server only).
CREATE TABLE IF NOT EXISTS public.newsdesk_seen_links (
  url text PRIMARY KEY,
  source text NOT NULL, -- the institution
  baseline boolean NOT NULL DEFAULT false, -- already on the page at the first reading
  first_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS newsdesk_seen_links_source_idx ON public.newsdesk_seen_links (source);
ALTER TABLE public.newsdesk_seen_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsdesk_seen_links FROM anon, authenticated;
GRANT ALL ON public.newsdesk_seen_links TO service_role;