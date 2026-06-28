GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, integer, integer) TO authenticated;