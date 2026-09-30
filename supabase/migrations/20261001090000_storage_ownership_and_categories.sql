-- Fix remaining scanner findings: storage read policies not tied to an owner
-- (avatars, site-assets) and unrestricted categories read.
-- "authenticated can read active app-releases" is intentionally unchanged: the
-- website's "Download the app" buttons need signed-in users to download the
-- file of the currently active release (and only that file).
-- No RLS is disabled and no data or files are deleted.

-- ---------------------------------------------------------------------------
-- 1. avatars + site-assets
--    Root cause: "Anyone can view avatars" / "Anyone can view site assets"
--    were SELECT policies checking only bucket_id. That let ANY caller
--    (including logged-out) list every file in the bucket and sign a URL for
--    ANY file, not just the ones the site displays.
--    Fix: profile pictures and site images are meant to be shown to everyone,
--    so serve them as a public bucket (files readable by exact URL only, no
--    listing, no API access) and scope the API SELECT policy to the owner.
--    The frontend now builds public URLs for these two buckets instead of
--    calling createSignedUrl (see src/hooks/useSignedUrl.ts).
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = true WHERE id IN ('avatars', 'site-assets');

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own avatar files" ON storage.objects;
CREATE POLICY "Users can read their own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can view site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins read site assets" ON storage.objects;
CREATE POLICY "Admins read site assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. categories
--    Root cause: "Categories viewable by everyone" used USING (true), exposing
--    deactivated categories too. Categories hold no personal data and the
--    forum needs them for logged-out visitors, so active ones stay public;
--    inactive ones are visible to admins only (the app already filters on
--    is_active = true for the public list).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Active categories viewable; inactive only by admins" ON public.categories;
CREATE POLICY "Active categories viewable; inactive only by admins"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()))
  );
