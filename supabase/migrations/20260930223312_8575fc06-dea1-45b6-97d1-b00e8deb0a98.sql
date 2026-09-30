DROP POLICY IF EXISTS "authenticated can read active app-releases" ON storage.objects;
DROP POLICY IF EXISTS "admins read app-releases" ON storage.objects;
CREATE POLICY "admins read app-releases"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));