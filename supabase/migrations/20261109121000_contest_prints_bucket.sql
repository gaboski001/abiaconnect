-- Contest certificates and voter-code slips made in the phone app. The app
-- can't print, so it makes a PDF, keeps it here for a few minutes and opens it
-- in the phone's PDF viewer to save, print or share. Private: each member can
-- only reach their own folder, and the app removes their old files each time.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contest-prints', 'contest-prints', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "contest prints: own folder read" ON storage.objects;
CREATE POLICY "contest prints: own folder read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contest-prints' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "contest prints: own folder upload" ON storage.objects;
CREATE POLICY "contest prints: own folder upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contest-prints' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "contest prints: own folder delete" ON storage.objects;
CREATE POLICY "contest prints: own folder delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contest-prints' AND (storage.foldername(name))[1] = auth.uid()::text);
