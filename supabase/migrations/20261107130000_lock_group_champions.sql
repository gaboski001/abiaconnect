-- The champions list linked members to the admin who chose them and could be
-- read by anyone, signed in or not. Nothing outside the admin page reads it
-- directly, and the alerts that use it run with their own rights. Admins see
-- the whole list; a champion sees only their own groups.
DROP POLICY IF EXISTS "Champions are public" ON public.group_champions;
DROP POLICY IF EXISTS "Admins and the champion can see champions" ON public.group_champions;
REVOKE ALL ON public.group_champions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.group_champions TO authenticated;
CREATE POLICY "Admins and the champion can see champions" ON public.group_champions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
