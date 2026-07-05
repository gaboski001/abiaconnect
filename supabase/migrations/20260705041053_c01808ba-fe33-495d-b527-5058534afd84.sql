
-- Realtime Authorization for WebRTC signaling channels.

CREATE POLICY "call-user read - target only"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE 'call-user:%'
  AND substring(realtime.topic() from 'call-user:(.*)')::uuid = (SELECT auth.uid())
);

CREATE POLICY "call-user write - conversation participants"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'call-user:%'
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (
      (c.user1_id = (SELECT auth.uid())
        AND c.user2_id = substring(realtime.topic() from 'call-user:(.*)')::uuid)
      OR
      (c.user2_id = (SELECT auth.uid())
        AND c.user1_id = substring(realtime.topic() from 'call-user:(.*)')::uuid)
    )
  )
);

CREATE POLICY "call-session read - authenticated"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.topic() LIKE 'call-session:%');

CREATE POLICY "call-session write - authenticated"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() LIKE 'call-session:%');
