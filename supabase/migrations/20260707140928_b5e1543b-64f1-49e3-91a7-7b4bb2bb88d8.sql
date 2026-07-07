
-- Uploads: only into own uid folder
CREATE POLICY "thread_attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'thread-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: any signed-in user (images embedded in threads)
CREATE POLICY "thread_attachments_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'thread-attachments');

-- Update own files
CREATE POLICY "thread_attachments_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'thread-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

-- Delete own files (or admins)
CREATE POLICY "thread_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'thread-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );
