
CREATE TABLE public.pwa_install_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL CHECK (event IN ('prompt_shown','accepted','dismissed','manual_click','installed')),
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.pwa_install_events TO anon, authenticated;
GRANT SELECT ON public.pwa_install_events TO authenticated;
GRANT ALL ON public.pwa_install_events TO service_role;
ALTER TABLE public.pwa_install_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can insert pwa events"
  ON public.pwa_install_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "admins can read pwa events"
  ON public.pwa_install_events FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE INDEX pwa_install_events_created_at_idx ON public.pwa_install_events (created_at DESC);
