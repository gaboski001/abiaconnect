
CREATE TABLE public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL,
  original_content text NOT NULL,
  original_title text,
  reason_shown text,
  categories text[],
  user_note text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT moderation_appeals_note_len CHECK (char_length(user_note) BETWEEN 5 AND 1000),
  CONSTRAINT moderation_appeals_content_len CHECK (char_length(original_content) BETWEEN 1 AND 10000)
);

GRANT SELECT, INSERT ON public.moderation_appeals TO authenticated;
GRANT ALL ON public.moderation_appeals TO service_role;

ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own appeals"
  ON public.moderation_appeals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can submit their own appeals"
  ON public.moderation_appeals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all appeals"
  ON public.moderation_appeals FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update appeals"
  ON public.moderation_appeals FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_moderation_appeals_updated_at
  BEFORE UPDATE ON public.moderation_appeals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_moderation_appeals_user ON public.moderation_appeals(user_id, created_at DESC);
CREATE INDEX idx_moderation_appeals_status ON public.moderation_appeals(status, created_at DESC);

-- Submitting helper with built-in rate limit (5 per hour).
CREATE OR REPLACE FUNCTION public.submit_moderation_appeal(
  _surface text,
  _original_content text,
  _original_title text,
  _reason_shown text,
  _categories text[],
  _user_note text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  PERFORM public.enforce_rate_limit('moderation_appeal', 5, 3600);

  INSERT INTO public.moderation_appeals (
    user_id, surface, original_content, original_title,
    reason_shown, categories, user_note
  ) VALUES (
    v_uid, _surface, _original_content, NULLIF(_original_title, ''),
    NULLIF(_reason_shown, ''), _categories, _user_note
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_moderation_appeal(text, text, text, text, text[], text) TO authenticated;
