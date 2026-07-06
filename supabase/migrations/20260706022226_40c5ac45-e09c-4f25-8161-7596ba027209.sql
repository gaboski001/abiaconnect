
-- ============================================================================
-- MESSAGES: reply, edit, delete-for-everyone, forward
-- ============================================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_from_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON public.messages(reply_to_id);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages(conversation_id, created_at DESC);

-- ============================================================================
-- Per-user conversation state (pin / archive)
-- One row per (conversation, user); each side owns their own view.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_states (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pinned_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_states TO authenticated;
GRANT ALL ON public.conversation_states TO service_role;

ALTER TABLE public.conversation_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own conversation state" ON public.conversation_states;
CREATE POLICY "Users manage their own conversation state"
  ON public.conversation_states
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS conversation_states_user_pinned_idx
  ON public.conversation_states(user_id, pinned_at DESC NULLS LAST);

-- ============================================================================
-- FUNCTION: edit_message  (15-minute window, sender only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.edit_message(_message_id uuid, _new_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_created timestamptz;
  v_deleted boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  IF _new_content IS NULL OR length(trim(_new_content)) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  SELECT sender_id, created_at, deleted_for_everyone
    INTO v_sender, v_created, v_deleted
    FROM public.messages WHERE id = _message_id;
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF v_sender <> v_uid THEN RAISE EXCEPTION 'You can only edit your own messages'; END IF;
  IF v_deleted THEN RAISE EXCEPTION 'Cannot edit a deleted message'; END IF;
  IF v_created < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Edit window (15 minutes) has passed';
  END IF;
  UPDATE public.messages
     SET content = _new_content,
         edited_at = now()
   WHERE id = _message_id;
END;
$$;

-- ============================================================================
-- FUNCTION: delete_message_for_everyone  (1-hour window, sender only)
-- Replaces content and clears attachment fields; keeps the row so both sides
-- render "This message was deleted".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_created timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT sender_id, created_at INTO v_sender, v_created
    FROM public.messages WHERE id = _message_id;
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF v_sender <> v_uid THEN RAISE EXCEPTION 'You can only delete your own messages'; END IF;
  IF v_created < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'Delete-for-everyone window (1 hour) has passed';
  END IF;
  UPDATE public.messages
     SET deleted_for_everyone = true,
         deleted_at = now(),
         content = NULL,
         attachment_url = NULL,
         attachment_path = NULL,
         attachment_type = NULL,
         attachment_name = NULL,
         attachment_size = NULL,
         attachment_expires_at = NULL
   WHERE id = _message_id;
END;
$$;

-- ============================================================================
-- FUNCTION: forward_message  (to a conversation the caller is part of)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.forward_message(_message_id uuid, _to_conversation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_src public.messages;
  v_new_id uuid;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;

  SELECT * INTO v_src FROM public.messages WHERE id = _message_id;
  IF v_src.id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF v_src.deleted_for_everyone THEN RAISE EXCEPTION 'Cannot forward a deleted message'; END IF;

  -- caller must be able to READ the source conversation
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = v_src.conversation_id
      AND (c.user1_id = v_uid OR c.user2_id = v_uid)
  ) INTO v_allowed;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Not allowed to forward this message'; END IF;

  -- caller must be a participant of the destination conversation
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _to_conversation_id
      AND (c.user1_id = v_uid OR c.user2_id = v_uid)
  ) INTO v_allowed;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Not a participant of the destination conversation'; END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, content,
    attachment_url, attachment_path, attachment_type,
    attachment_name, attachment_size, attachment_expires_at,
    forwarded_from_id
  ) VALUES (
    _to_conversation_id, v_uid, v_src.content,
    v_src.attachment_url, v_src.attachment_path, v_src.attachment_type,
    v_src.attachment_name, v_src.attachment_size, v_src.attachment_expires_at,
    v_src.id
  ) RETURNING id INTO v_new_id;

  UPDATE public.conversations SET updated_at = now() WHERE id = _to_conversation_id;
  RETURN v_new_id;
END;
$$;

-- ============================================================================
-- FUNCTIONS: pin / archive per-user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_conversation_pinned(_conversation_id uuid, _pinned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user1_id = v_uid OR c.user2_id = v_uid)
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Not a participant'; END IF;

  INSERT INTO public.conversation_states (conversation_id, user_id, pinned_at)
    VALUES (_conversation_id, v_uid, CASE WHEN _pinned THEN now() ELSE NULL END)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET pinned_at = CASE WHEN _pinned THEN COALESCE(public.conversation_states.pinned_at, now()) ELSE NULL END,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_conversation_archived(_conversation_id uuid, _archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user1_id = v_uid OR c.user2_id = v_uid)
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Not a participant'; END IF;

  INSERT INTO public.conversation_states (conversation_id, user_id, archived_at)
    VALUES (_conversation_id, v_uid, CASE WHEN _archived THEN now() ELSE NULL END)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET archived_at = CASE WHEN _archived THEN COALESCE(public.conversation_states.archived_at, now()) ELSE NULL END,
        updated_at = now();
END;
$$;

-- ============================================================================
-- FUNCTIONS: clear / delete conversation
-- clear_conversation = wipe messages, keep the chat
-- delete_conversation = wipe messages and the conversation itself
-- ============================================================================
CREATE OR REPLACE FUNCTION public.clear_conversation(_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user1_id = v_uid OR c.user2_id = v_uid)
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Not a participant'; END IF;

  DELETE FROM public.messages WHERE conversation_id = _conversation_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.conversations SET updated_at = now() WHERE id = _conversation_id;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_conversation(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='28000'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user1_id = v_uid OR c.user2_id = v_uid)
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Not a participant'; END IF;

  DELETE FROM public.messages WHERE conversation_id = _conversation_id;
  DELETE FROM public.conversation_states WHERE conversation_id = _conversation_id;
  DELETE FROM public.conversations WHERE id = _conversation_id;
END;
$$;

-- ============================================================================
-- Realtime: broadcast row-level changes on messages so both sides see edits,
-- deletes and forwards without a refetch. conversation_states already streams
-- via the default publication once it's added.
-- ============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_states;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_states REPLICA IDENTITY FULL;
