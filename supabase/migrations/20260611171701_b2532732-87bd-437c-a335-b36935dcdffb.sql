
-- ============ PROFILES ============
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Prevent self-elevation / un-ban / reputation tampering
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.role        := OLD.role;
  NEW.is_banned   := OLD.is_banned;
  NEW.is_deleted  := OLD.is_deleted;
  NEW.reputation  := OLD.reputation;
  NEW.email       := OLD.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "Admins create notifications" ON public.notifications;
CREATE POLICY "Admins create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ POLLS ============
DROP POLICY IF EXISTS "Users create polls" ON public.polls;
CREATE POLICY "Admins create polls"
  ON public.polls FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = created_by);

-- ============ POLL VOTES ============
DROP POLICY IF EXISTS "Poll votes viewable by everyone" ON public.poll_votes;
CREATE POLICY "Users see own poll votes"
  ON public.poll_votes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Aggregated counts available to everyone (no user_id leaked)
CREATE OR REPLACE FUNCTION public.get_poll_counts(_poll_ids uuid[])
RETURNS TABLE(poll_id uuid, poll_option_id uuid, vote_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT poll_id, poll_option_id, count(*)::bigint
  FROM public.poll_votes
  WHERE poll_id = ANY(_poll_ids)
  GROUP BY poll_id, poll_option_id;
$$;
REVOKE ALL ON FUNCTION public.get_poll_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_poll_counts(uuid[]) TO anon, authenticated, service_role;

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "Participants update messages" ON public.messages;
CREATE POLICY "Sender updates own message"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

CREATE OR REPLACE FUNCTION public.mark_message_read(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages m
     SET is_read = true
   WHERE m.id = _message_id
     AND EXISTS (
       SELECT 1 FROM public.conversations c
        WHERE c.id = m.conversation_id
          AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
     )
     AND m.sender_id <> auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.mark_message_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated, service_role;

-- ============ STORAGE: site-assets admin-only writes ============
DROP POLICY IF EXISTS "Authenticated users can upload site assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update site assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete site assets" ON storage.objects;

CREATE POLICY "Admins upload site assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update site assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete site assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- ============ Tighten EXECUTE on internal functions ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
