
ALTER PUBLICATION supabase_realtime DROP TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;

CREATE POLICY chat_attachments_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.id)::text = (storage.foldername(objects.name))[1]
      AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  )
)
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.id)::text = (storage.foldername(objects.name))[1]
      AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  )
);
