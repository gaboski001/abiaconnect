-- Fix remaining scanner findings while keeping buckets PRIVATE (the
-- workspace does not allow public buckets).
-- No RLS is disabled, no bucket settings change, no data or files are deleted.

-- ---------------------------------------------------------------------------
-- Root cause: "Anyone can view avatars" / "Anyone can view site assets" only
-- checked bucket_id, so anyone (including logged-out visitors) could list
-- every file and sign a URL for ANY file in those buckets, not just the ones
-- the site displays.
--
-- Fix: reads are allowed only for
--   * the file's owner (avatars: first folder = user id), or admins
--     (site-assets), and
--   * files the site currently displays publicly: a user's CURRENT profile
--     picture, the configured site logo, and the About page images.
-- Old/replaced uploads and anything not on display are no longer readable
-- by others. The app keeps loading images via createSignedUrl, unchanged.
-- ---------------------------------------------------------------------------

-- True when a storage object is currently shown publicly by the site.
-- SECURITY DEFINER so it can check profiles/site_settings for any caller;
-- it only returns a boolean for a given object name.
CREATE OR REPLACE FUNCTION public.is_displayed_storage_object(_bucket text, _name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _bucket
    WHEN 'avatars' THEN EXISTS (
      -- Avatars live in "<user id>/<file>"; match only that user's profile
      -- (primary-key lookup) and only their current avatar_url, which may be
      -- stored as a bare path, "avatars/<path>" or a full storage URL.
      SELECT 1
      FROM public.profiles p
      WHERE p.id::text = (storage.foldername(_name))[1]
        AND COALESCE(p.is_deleted, false) = false
        AND p.avatar_url IS NOT NULL
        AND (
          p.avatar_url = _name
          OR p.avatar_url = 'avatars/' || _name
          OR position('/avatars/' || _name IN p.avatar_url) > 0
        )
    )
    WHEN 'site-assets' THEN
      (storage.foldername(_name))[1] = 'about'
      OR EXISTS (
        SELECT 1
        FROM public.site_settings s
        WHERE s.key IN ('site_logo', 'logo_url')
          AND s.value IS NOT NULL
          AND (
            s.value #>> '{}' = _name
            OR s.value #>> '{}' = 'site-assets/' || _name
            OR position('/site-assets/' || _name IN (s.value #>> '{}')) > 0
          )
      )
    ELSE false
  END
$$;

-- Evaluated inside storage policies for logged-out and signed-in callers.
REVOKE EXECUTE ON FUNCTION public.is_displayed_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_displayed_storage_object(text, text) TO anon, authenticated, service_role;

-- avatars ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Read own or currently displayed avatars" ON storage.objects;
CREATE POLICY "Read own or currently displayed avatars"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
      OR public.is_displayed_storage_object('avatars', name)
    )
  );

-- site-assets -----------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view site assets" ON storage.objects;
DROP POLICY IF EXISTS "Read displayed site assets; admins read all" ON storage.objects;
CREATE POLICY "Read displayed site assets; admins read all"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'site-assets'
    AND (
      (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()))
      OR public.is_displayed_storage_object('site-assets', name)
    )
  );

-- ---------------------------------------------------------------------------
-- categories
-- Root cause: "Categories viewable by everyone" used USING (true), exposing
-- deactivated categories too. Categories hold no personal data and the forum
-- needs them for logged-out visitors, so active ones stay public; inactive
-- ones are admin-only (the public list already filters is_active = true).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Active categories viewable; inactive only by admins" ON public.categories;
CREATE POLICY "Active categories viewable; inactive only by admins"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR (auth.uid() IS NOT NULL AND public.is_admin(auth.uid()))
  );

-- NOTE: "authenticated can read active app-releases" is intentionally
-- unchanged: the website's "Download the app" buttons need signed-in users to
-- download the file of the currently active release (and only that file).
