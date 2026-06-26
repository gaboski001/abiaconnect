-- 1) threads.private_author_id: never expose to clients via SELECT projection.
--    RLS USING clauses still evaluate it server-side (column privileges do not
--    affect policy expressions), so author/admin update/delete keep working.
REVOKE SELECT (private_author_id) ON public.threads FROM anon, authenticated;

-- 2) site_settings: switch from denylist (`key NOT LIKE 'smtp_%'`) to an
--    explicit allowlist so any new sensitive key is private by default.
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
    'hero_slide_interval_seconds'
  ));