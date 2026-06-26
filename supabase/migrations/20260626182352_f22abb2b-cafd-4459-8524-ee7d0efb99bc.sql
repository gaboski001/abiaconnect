GRANT EXECUTE ON FUNCTION public.is_subgroup_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_subgroup_admin(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_subgroup_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;