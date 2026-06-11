
-- RLS policies for avatars bucket
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for site-assets bucket
CREATE POLICY "Anyone can view site assets" ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
CREATE POLICY "Authenticated users can upload site assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'site-assets');
CREATE POLICY "Authenticated users can update site assets" ON storage.objects FOR UPDATE USING (bucket_id = 'site-assets');
CREATE POLICY "Authenticated users can delete site assets" ON storage.objects FOR DELETE USING (bucket_id = 'site-assets');
