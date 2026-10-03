-- App store links are public: the "Get the app" card and the in-app update
-- prompt show Google Play / App Store badges to everyone (signed in or not).
-- Same explicit allowlist as before, plus play_store_url and app_store_url.
-- An empty or missing value means "Coming soon".

DROP POLICY IF EXISTS "Public site settings readable" ON public.site_settings;
CREATE POLICY "Public site settings readable"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (key IN (
    'site_logo',
    'site_theme',
    'store_link',
    'hero_slide_duration_days',
    'hero_slide_interval_seconds',
    'play_store_url',
    'app_store_url'
  ));
