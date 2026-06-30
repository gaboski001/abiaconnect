CREATE TABLE public.moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  surface text NOT NULL DEFAULT 'thread',
  allowed boolean NOT NULL,
  reason text,
  categories text[] NOT NULL DEFAULT '{}',
  title text,
  content_excerpt text,
  degraded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.moderation_log TO authenticated;
GRANT ALL ON public.moderation_log TO service_role;

ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all moderation logs"
  ON public.moderation_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own moderation logs"
  ON public.moderation_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_moderation_log_created_at ON public.moderation_log (created_at DESC);
CREATE INDEX idx_moderation_log_user_id ON public.moderation_log (user_id);
CREATE INDEX idx_moderation_log_allowed ON public.moderation_log (allowed) WHERE allowed = false;