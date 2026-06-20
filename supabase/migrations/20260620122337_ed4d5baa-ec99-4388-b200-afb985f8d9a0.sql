
CREATE TABLE public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('android','ios')),
  version text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_releases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view active releases" ON public.app_releases
  FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage releases" ON public.app_releases
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Storage policies on app-releases bucket
CREATE POLICY "authenticated can read app-releases"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'app-releases');

CREATE POLICY "admins upload app-releases"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));

CREATE POLICY "admins update app-releases"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));

CREATE POLICY "admins delete app-releases"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));
