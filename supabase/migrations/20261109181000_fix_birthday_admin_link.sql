-- The admins' birthday reminder linked to /admin, which doesn't exist; the
-- admin pages live under /admin/dashboard.
CREATE OR REPLACE FUNCTION public.birthday_tell_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_msg text;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(p.display_name, ''), p.username, 'A member') INTO v_name
      FROM public.profiles p WHERE p.id = NEW.user_id AND p.share_birthday;
    IF v_name IS NOT NULL THEN
      v_msg := '🎂 It''s ' || v_name || '''s birthday today. Send them your wishes!';
      INSERT INTO public.notifications (user_id, type, message, link)
      SELECT f.follower_id, 'birthday_friend', v_msg, '/'
        FROM public.connect_follows f
        JOIN public.profiles p ON p.id = f.follower_id AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
       WHERE f.followed_id = NEW.user_id
         AND NOT EXISTS (SELECT 1 FROM public.notifications n
                          WHERE n.user_id = f.follower_id AND n.type = 'birthday_friend'
                            AND n.message = v_msg AND n.created_at > now() - interval '20 hours');
    END IF;

    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT DISTINCT r.user_id, 'birthday_admin',
           '🎂 Members are celebrating their birthday today. Send them the team''s wishes.',
           '/admin/dashboard?section=birthdays'
      FROM public.user_roles r
     WHERE r.role IN ('Admin', 'Super Admin')
       AND r.user_id <> NEW.user_id
       AND NOT EXISTS (SELECT 1 FROM public.notifications n
                        WHERE n.user_id = r.user_id AND n.type = 'birthday_admin'
                          AND n.created_at > now() - interval '20 hours');
  EXCEPTION WHEN OTHERS THEN
    -- Never stop the birthday greeting itself.
    RAISE WARNING 'birthday_tell_community: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
UPDATE public.notifications SET link = '/admin/dashboard?section=birthdays'
 WHERE type = 'birthday_admin' AND link = '/admin?section=birthdays';
