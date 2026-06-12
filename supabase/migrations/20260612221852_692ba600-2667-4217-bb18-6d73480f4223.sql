CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.messages m
     SET is_read = true
   WHERE m.conversation_id = _conversation_id
     AND m.sender_id <> auth.uid()
     AND m.is_read = false
     AND EXISTS (
       SELECT 1 FROM public.conversations c
        WHERE c.id = m.conversation_id
          AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id)
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;