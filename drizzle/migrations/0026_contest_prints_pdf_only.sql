-- Contest PDFs take as little room as possible: the private "contest-prints"
-- storage only takes .pdf files (the app also deletes each file as soon as the
-- member is back from viewing it).
DROP POLICY IF EXISTS "contest prints: own folder upload" ON storage.objects;
CREATE POLICY "contest prints: own folder upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contest-prints'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = 'pdf'
  );