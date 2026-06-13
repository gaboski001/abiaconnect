CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete yourself';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.user_known_devices WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.bookmarks WHERE user_id = _user_id;
  DELETE FROM public.thread_votes WHERE user_id = _user_id;
  DELETE FROM public.reply_votes WHERE user_id = _user_id;
  DELETE FROM public.poll_votes WHERE user_id = _user_id;
  DELETE FROM public.replies WHERE user_id = _user_id;
  DELETE FROM public.threads WHERE private_author_id = _user_id OR author_id = _user_id OR user_id = _user_id;
  DELETE FROM public.subgroup_members WHERE user_id = _user_id;
  DELETE FROM public.messages WHERE sender_id = _user_id;
  DELETE FROM public.conversations WHERE user1_id = _user_id OR user2_id = _user_id;
  DELETE FROM public.achievements WHERE user_id = _user_id;
  DELETE FROM public.reports WHERE reporter_id = _user_id OR reported_user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;

  DELETE FROM auth.users WHERE id = _user_id;
END;
$function$;