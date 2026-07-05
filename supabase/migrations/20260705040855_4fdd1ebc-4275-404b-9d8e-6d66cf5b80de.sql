
-- Realtime Authorization for subgroup-presence:{subgroup_id} channels.
-- Only members of the subgroup may join/read/broadcast presence.

CREATE POLICY "subgroup presence read - members only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'subgroup-presence:%')
  AND public.is_subgroup_member(
    substring(realtime.topic() from 'subgroup-presence:(.*)')::uuid,
    (SELECT auth.uid())
  )
);

CREATE POLICY "subgroup presence write - members only"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'subgroup-presence:%')
  AND public.is_subgroup_member(
    substring(realtime.topic() from 'subgroup-presence:(.*)')::uuid,
    (SELECT auth.uid())
  )
);
