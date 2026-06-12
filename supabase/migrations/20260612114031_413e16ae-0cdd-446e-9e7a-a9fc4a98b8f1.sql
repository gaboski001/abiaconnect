
CREATE OR REPLACE FUNCTION public.get_thread_reply_counts(_thread_ids uuid[])
RETURNS TABLE(thread_id uuid, reply_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT thread_id, count(*)::bigint
  FROM public.replies
  WHERE thread_id = ANY(_thread_ids)
  GROUP BY thread_id
$$;
REVOKE ALL ON FUNCTION public.get_thread_reply_counts(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_thread_reply_counts(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_thread_view(_thread_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.threads SET view_count = view_count + 1 WHERE id = _thread_id;
$$;
REVOKE ALL ON FUNCTION public.increment_thread_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_thread_view(uuid) TO anon, authenticated;
