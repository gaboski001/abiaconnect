-- Listening side of the call health record: how loud the sound arriving from
-- the other phone was, and whether the in-app player was playing it.
ALTER TABLE public.call_health ADD COLUMN IF NOT EXISTS heard_energy double precision;
ALTER TABLE public.call_health ADD COLUMN IF NOT EXISTS player_state text CHECK (length(player_state) <= 40);
NOTIFY pgrst, 'reload schema';
