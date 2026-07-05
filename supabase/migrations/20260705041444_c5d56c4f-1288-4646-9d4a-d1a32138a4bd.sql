-- Track call sessions so signaling channels can be scoped to participants
CREATE TABLE public.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL UNIQUE,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.call_sessions TO authenticated;
GRANT ALL ON public.call_sessions TO service_role;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their call sessions"
ON public.call_sessions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IN (caller_id, callee_id));

CREATE POLICY "Caller can create a call session"
ON public.call_sessions FOR INSERT TO authenticated
WITH CHECK (caller_id = (SELECT auth.uid()) AND callee_id <> (SELECT auth.uid()));

-- Replace unscoped call-session realtime policies with participant checks
DROP POLICY IF EXISTS "call-session read - authenticated" ON realtime.messages;
DROP POLICY IF EXISTS "call-session write - authenticated" ON realtime.messages;

CREATE POLICY "call-session read - participants only"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE 'call-session:%'
  AND EXISTS (
    SELECT 1 FROM public.call_sessions cs
    WHERE cs.call_id = substring(realtime.topic() from 'call-session:(.*)')
      AND (SELECT auth.uid()) IN (cs.caller_id, cs.callee_id)
  )
);

CREATE POLICY "call-session write - participants only"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'call-session:%'
  AND EXISTS (
    SELECT 1 FROM public.call_sessions cs
    WHERE cs.call_id = substring(realtime.topic() from 'call-session:(.*)')
      AND (SELECT auth.uid()) IN (cs.caller_id, cs.callee_id)
  )
);