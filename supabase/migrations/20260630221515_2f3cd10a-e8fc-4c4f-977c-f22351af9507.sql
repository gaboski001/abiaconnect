ALTER TABLE public.moderation_log
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_note text,
  ADD COLUMN overridden boolean NOT NULL DEFAULT false;

CREATE POLICY "Admins can update moderation logs"
  ON public.moderation_log FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT UPDATE ON public.moderation_log TO authenticated;