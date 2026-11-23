-- A few numbers saved by each phone when a call ends (no sound or content),
-- so "they can't hear me" reports can be traced to the phone whose
-- microphone went quiet (src/lib/webrtcCall.ts saveCallHealth).
CREATE TABLE IF NOT EXISTS public.call_health (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  call_id text NOT NULL CHECK (length(call_id) <= 64),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('caller', 'callee')),
  video boolean,
  seconds integer,
  mic_energy double precision,
  audio_bytes_sent bigint,
  audio_bytes_received bigint,
  mic_restarts integer,
  mic_state text CHECK (length(mic_state) <= 40),
  self_muted boolean,
  speaker_on boolean,
  native_app boolean,
  device text CHECK (length(device) <= 300)
);
CREATE INDEX IF NOT EXISTS call_health_created_idx ON public.call_health (created_at DESC);

ALTER TABLE public.call_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_health FROM anon;
GRANT INSERT ON public.call_health TO authenticated;
GRANT USAGE ON SEQUENCE public.call_health_id_seq TO authenticated;
GRANT SELECT ON public.call_health TO authenticated;

DROP POLICY IF EXISTS "Members save their own call health" ON public.call_health;
CREATE POLICY "Members save their own call health" ON public.call_health
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read call health" ON public.call_health;
CREATE POLICY "Admins read call health" ON public.call_health
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
