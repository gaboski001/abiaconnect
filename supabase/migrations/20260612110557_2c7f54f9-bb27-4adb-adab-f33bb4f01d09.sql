
-- Security definer helper to check membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_subgroup_member(_subgroup_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subgroup_members
    WHERE subgroup_id = _subgroup_id AND user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_subgroup_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_subgroup_member(uuid, uuid) TO authenticated, service_role;

-- Replace the recursive SELECT policy
DROP POLICY IF EXISTS "Members of public subgroups viewable by authenticated" ON public.subgroup_members;

CREATE POLICY "Members viewable without recursion"
ON public.subgroup_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subgroups s
    WHERE s.id = subgroup_members.subgroup_id AND s.is_private = false
  )
  OR public.is_subgroup_member(subgroup_members.subgroup_id, auth.uid())
  OR public.is_admin(auth.uid())
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_subgroup_members_subgroup_user
  ON public.subgroup_members(subgroup_id, user_id);
