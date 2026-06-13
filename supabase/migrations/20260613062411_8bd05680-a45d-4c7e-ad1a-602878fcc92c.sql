DROP POLICY IF EXISTS "Public site settings readable" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can read all site settings" ON public.site_settings;

CREATE POLICY "Public site settings readable"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (key NOT LIKE 'smtp_%');

CREATE POLICY "Admins can read all site settings"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));