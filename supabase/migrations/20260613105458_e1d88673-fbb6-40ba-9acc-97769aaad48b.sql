
CREATE TABLE public.user_known_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  user_agent text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);
GRANT SELECT, INSERT, UPDATE ON public.user_known_devices TO authenticated;
GRANT ALL ON public.user_known_devices TO service_role;
ALTER TABLE public.user_known_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own devices"
  ON public.user_known_devices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_known_devices_user_idx ON public.user_known_devices(user_id);
