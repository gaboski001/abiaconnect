
-- 1) Profiles: lock down sensitive columns
REVOKE SELECT (email, dob) ON public.profiles FROM anon, authenticated;

-- Own profile self-read (includes email/dob)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Username -> email lookup for login (no enumeration of fields)
CREATE OR REPLACE FUNCTION public.resolve_username_to_email(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE lower(username) = lower(_username)
    AND is_deleted = false
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_username_to_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(text) TO anon, authenticated;

-- Admin-only bulk email lookup
CREATE OR REPLACE FUNCTION public.admin_get_user_emails(_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND public.is_admin(auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;

-- Admin search by email
CREATE OR REPLACE FUNCTION public.admin_search_user_ids_by_email(_term text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE public.is_admin(auth.uid())
    AND p.email ILIKE ('%' || _term || '%')
$$;
REVOKE EXECUTE ON FUNCTION public.admin_search_user_ids_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_user_ids_by_email(text) TO authenticated;

-- 2) Messages: enforce sender is a conversation participant on INSERT
DROP POLICY IF EXISTS "Sender inserts messages" ON public.messages;
CREATE POLICY "Sender inserts messages in own conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
  )
);

-- 3) Thread votes: restrict reads to own row; expose aggregate counts via function
DROP POLICY IF EXISTS "Votes viewable by everyone" ON public.thread_votes;
CREATE POLICY "Users view own thread votes"
ON public.thread_votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

REVOKE SELECT ON public.thread_votes FROM anon;

CREATE OR REPLACE FUNCTION public.get_thread_vote_counts(_thread_ids uuid[])
RETURNS TABLE(thread_id uuid, upvotes bigint, downvotes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    thread_id,
    sum(CASE WHEN value = 1 THEN 1 ELSE 0 END)::bigint AS upvotes,
    sum(CASE WHEN value = -1 THEN 1 ELSE 0 END)::bigint AS downvotes
  FROM public.thread_votes
  WHERE thread_id = ANY(_thread_ids)
  GROUP BY thread_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_thread_vote_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_thread_vote_counts(uuid[]) TO anon, authenticated;

-- 4) Achievements: signed-in users only
DROP POLICY IF EXISTS "Achievements viewable by everyone" ON public.achievements;
CREATE POLICY "Authenticated users view achievements"
ON public.achievements
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.achievements FROM anon;
