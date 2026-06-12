
CREATE OR REPLACE FUNCTION public.get_thread_subgroup_id(_thread_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subgroup_id FROM public.threads WHERE id = _thread_id
$$;

REVOKE ALL ON FUNCTION public.get_thread_subgroup_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_thread_subgroup_id(uuid) TO authenticated, service_role;
