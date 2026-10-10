CREATE OR REPLACE FUNCTION public.newsdesk_share_feed()
RETURNS TABLE (thread_id uuid, title text, banner_title text, banner_url text, content text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.thread_id, t.title, n.banner_title, n.banner_url, n.content
    FROM public.newsdesk_posts n
    JOIN public.threads t ON t.id = n.thread_id
   WHERE n.status = 'published'
     AND n.banner_url IS NOT NULL
     AND NOT t.is_deleted
     AND n.created_at > now() - interval '45 days'
   ORDER BY n.created_at DESC
   LIMIT 300
$$;
REVOKE EXECUTE ON FUNCTION public.newsdesk_share_feed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsdesk_share_feed() TO anon, authenticated, service_role;