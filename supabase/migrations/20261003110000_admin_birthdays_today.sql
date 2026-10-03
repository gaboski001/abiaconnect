-- Admin -> "Birthdays today" panel.
--   admin_birthdays_today()      members whose birthday is today (Lagos time),
--                                with whether they were greeted / emailed
--   admin_birthday_coverage()    how many members have a birthday saved
--   admin_find_members(q)        look a member up by name or username
--   admin_set_member_dob(id, d)  save a member's birthday for them; if it is
--                                today, the greet_birthday_if_today trigger
--                                greets them straight away
-- All are admin-only (checked inside each function).

CREATE OR REPLACE FUNCTION public.birthday_is_today(_dob date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH t AS (SELECT (now() AT TIME ZONE 'Africa/Lagos')::date AS d)
  SELECT _dob IS NOT NULL AND (
    (extract(month FROM _dob) = extract(month FROM t.d) AND extract(day FROM _dob) = extract(day FROM t.d))
    OR (extract(month FROM _dob) = 2 AND extract(day FROM _dob) = 29
        AND extract(month FROM t.d) = 2 AND extract(day FROM t.d) = 28
        AND NOT (extract(year FROM t.d)::int % 4 = 0
                 AND (extract(year FROM t.d)::int % 100 <> 0 OR extract(year FROM t.d)::int % 400 = 0)))
  )
  FROM t
$$;

CREATE OR REPLACE FUNCTION public.admin_birthdays_today()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  turning integer,
  has_email boolean,
  greeted boolean,
  emailed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_start timestamptz := ((now() AT TIME ZONE 'Africa/Lagos')::date)::timestamp AT TIME ZONE 'Africa/Lagos';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id,
         p.display_name,
         p.username,
         p.avatar_url,
         (extract(year FROM (now() AT TIME ZONE 'Africa/Lagos')) - extract(year FROM p.dob))::int,
         p.email IS NOT NULL,
         EXISTS (SELECT 1 FROM public.notifications n
                  WHERE n.user_id = p.id AND n.type = 'birthday' AND n.created_at >= v_start),
         EXISTS (SELECT 1 FROM public.email_send_log e
                  WHERE e.template_name = 'birthday-greeting' AND e.recipient_email = p.email
                    AND e.status = 'sent' AND e.created_at >= v_start)
    FROM public.profiles p
   WHERE public.birthday_is_today(p.dob)
     AND NOT coalesce(p.is_banned, false)
     AND NOT coalesce(p.is_deleted, false)
   ORDER BY coalesce(p.display_name, p.username);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_birthday_coverage()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'members', count(*),
      'with_birthday', count(*) FILTER (WHERE dob IS NOT NULL)
    )
    FROM public.profiles
    WHERE NOT coalesce(is_banned, false) AND NOT coalesce(is_deleted, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_find_members(_q text)
RETURNS TABLE (user_id uuid, display_name text, username text, dob date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(_q, ''))) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, p.username, p.dob
    FROM public.profiles p
   WHERE NOT coalesce(p.is_deleted, false)
     AND (p.display_name ILIKE '%' || trim(_q) || '%' OR p.username ILIKE '%' || trim(_q) || '%')
   ORDER BY coalesce(p.display_name, p.username)
   LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_member_dob(_user_id uuid, _dob date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_age int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  IF _dob IS NULL OR _dob > (now() AT TIME ZONE 'Africa/Lagos')::date THEN
    RAISE EXCEPTION 'Enter a real date of birth' USING ERRCODE = 'P0001';
  END IF;
  v_age := extract(year FROM age((now() AT TIME ZONE 'Africa/Lagos')::date, _dob));
  IF v_age < 13 OR v_age > 120 THEN
    RAISE EXCEPTION 'Members must be between 13 and 120 years old' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.profiles SET dob = _dob WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_birthdays_today() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_birthday_coverage() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_find_members(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_member_dob(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_birthdays_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_birthday_coverage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_members(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_member_dob(uuid, date) TO authenticated;
