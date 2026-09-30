-- Harden access rules flagged by the security scan.
-- No RLS is disabled, no data is deleted, and every query the app makes
-- today keeps working (the app only lists active subgroups/polls; admins
-- keep full visibility through is_admin()).

-- ---------------------------------------------------------------------------
-- 1. subgroups: was readable by everyone (USING true), including deactivated
--    groups. Active groups stay discoverable (private ones too, so non-members
--    can see them and send a join request); inactive groups are limited to
--    their creator, their members and admins.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subgroups viewable by everyone" ON public.subgroups;
DROP POLICY IF EXISTS "Active subgroups viewable; inactive only by owner, members, admins" ON public.subgroups;
CREATE POLICY "Active subgroups viewable; inactive only by owner, members, admins"
  ON public.subgroups FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR (auth.uid() IS NOT NULL AND (
      created_by = auth.uid()
      OR public.is_subgroup_member(id, auth.uid())
      OR public.is_admin(auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- 2. polls: was readable by everyone, including closed/draft polls.
--    Active polls stay public; inactive ones only for their creator and admins.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Polls viewable by everyone" ON public.polls;
DROP POLICY IF EXISTS "Active polls viewable; inactive only by owner or admin" ON public.polls;
CREATE POLICY "Active polls viewable; inactive only by owner or admin"
  ON public.polls FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR (auth.uid() IS NOT NULL AND (
      created_by = auth.uid()
      OR public.is_admin(auth.uid())
    ))
  );

-- ---------------------------------------------------------------------------
-- 3. poll_options: was readable by everyone. Options are now visible exactly
--    when their poll is visible (the subquery runs under the polls policy).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Poll options viewable by everyone" ON public.poll_options;
DROP POLICY IF EXISTS "Poll options follow poll visibility" ON public.poll_options;
CREATE POLICY "Poll options follow poll visibility"
  ON public.poll_options FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id));

-- Owner/admin UPDATE policies had no WITH CHECK; make it explicit so an
-- updated row must still belong to the same owner (or be done by an admin).
DROP POLICY IF EXISTS "Owner or admin update poll" ON public.polls;
CREATE POLICY "Owner or admin update poll"
  ON public.polls FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Owner or admin update subgroup" ON public.subgroups;
CREATE POLICY "Owner or admin update subgroup"
  ON public.subgroups FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_admin(auth.uid()));

-- NOTE: public.categories keeps public read access on purpose. It only holds
-- forum category names/descriptions/icons (no personal data), and the forum
-- home page needs it for logged-out visitors. Writes remain admin-only.

-- ---------------------------------------------------------------------------
-- 4. Storage: thread-attachments
--    SELECT let ANY signed-in user download ANY user's attachment. Threads
--    embed long-lived signed URLs created by the uploader at upload time, and
--    signed URLs don't need a SELECT policy, so read access can be limited to
--    the file's owner (first folder = user id) and admins.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "thread_attachments_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "thread_attachments_select_own" ON storage.objects;
CREATE POLICY "thread_attachments_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'thread-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

-- UPDATE had no WITH CHECK: a file could be renamed/moved into another
-- user's folder. The new path must now stay in the caller's own folder.
DROP POLICY IF EXISTS "thread_attachments_update_own" ON storage.objects;
CREATE POLICY "thread_attachments_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'thread-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'thread-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 5. Storage: avatars write policies applied to every role (incl. anon) and
--    UPDATE had no WITH CHECK, so an owner could move a file into someone
--    else's folder. Scope to signed-in users and pin the path to their folder.
--    (Public READ of avatars/site-assets is intentional: profile pictures and
--    the site logo are shown to logged-out visitors via signed URLs.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload their own avatar" ON storage.objects;
CREATE POLICY "Authenticated users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- app-releases admin UPDATE had no WITH CHECK.
DROP POLICY IF EXISTS "admins update app-releases" ON storage.objects;
CREATE POLICY "admins update app-releases"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-releases' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'app-releases' AND public.is_admin(auth.uid()));