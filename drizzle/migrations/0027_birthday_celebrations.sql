-- Birthday celebrations: the whole community can celebrate a member's birthday.
--   * profiles.share_birthday   members can turn off telling others (on by default).
--                               Only the day is shared, never the year or age.
--   * birthday_wishes           one wish per member per birthday; admins' wishes
--                               show as "from the AbiaConnect team".
--   * birthdays_today()         who is celebrating today (for the home screen card).
--   * send_birthday_wish()      sends a wish and tells the birthday person.
--   * my_birthday_wishes()      the wishes a member received today.
--   * set_share_birthday()      the "Let members celebrate my birthday" switch.
--   * When the daily birthday greeting lands, the member's followers are told
--     "It's X's birthday today", and admins get one reminder a day.
-- New members automatically follow the main admin (@Gabby).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS share_birthday boolean NOT NULL DEFAULT true;

-- Finds today's birthdays without reading every profile.
CREATE INDEX IF NOT EXISTS profiles_birthday_idx
  ON public.profiles ((extract(month FROM dob)::int), (extract(day FROM dob)::int))
  WHERE dob IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.birthday_wishes (
  birthday_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
  from_team boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (birthday_user, year, from_user),
  CHECK (birthday_user <> from_user)
);
ALTER TABLE public.birthday_wishes ENABLE ROW LEVEL SECURITY;
-- Members only reach wishes through the functions below.
REVOKE ALL ON public.birthday_wishes FROM PUBLIC, anon, authenticated;

-- Members whose birthday is today (Lagos time). People born on 29 February
-- celebrate on 28 February in other years. Internal helper.
CREATE OR REPLACE FUNCTION public.birthday_ids_today()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH t AS (SELECT (now() AT TIME ZONE 'Africa/Lagos')::date AS d)
  SELECT p.id
    FROM public.profiles p, t
   WHERE p.dob IS NOT NULL
     AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
     AND extract(month FROM p.dob)::int = extract(month FROM t.d)::int
     AND (extract(day FROM p.dob)::int = extract(day FROM t.d)::int
          OR (extract(month FROM t.d)::int = 2 AND extract(day FROM t.d)::int = 28
              AND extract(month FROM t.d + 1)::int = 3 AND extract(day FROM p.dob)::int = 29));
$$;
REVOKE EXECUTE ON FUNCTION public.birthday_ids_today() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.birthday_year_now()
RETURNS int
LANGUAGE sql
STABLE
AS $$ SELECT extract(year FROM (now() AT TIME ZONE 'Africa/Lagos'))::int $$;

-- Who is celebrating today, for signed-in members (not the member themself).
CREATE OR REPLACE FUNCTION public.birthdays_today()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_year int := public.birthday_year_now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x.row ORDER BY x.name)
      FROM (
        SELECT COALESCE(NULLIF(p.display_name, ''), p.username, 'A member') AS name,
               jsonb_build_object(
                 'id', p.id,
                 'name', COALESCE(NULLIF(p.display_name, ''), p.username, 'A member'),
                 'username', p.username,
                 'avatar_url', p.avatar_url,
                 'wishes', (SELECT count(*) FROM public.birthday_wishes w WHERE w.birthday_user = p.id AND w.year = v_year),
                 'wished', EXISTS (SELECT 1 FROM public.birthday_wishes w
                                    WHERE w.birthday_user = p.id AND w.year = v_year AND w.from_user = v_uid)
               ) AS row
          FROM public.birthday_ids_today() b
          JOIN public.profiles p ON p.id = b.id
         WHERE p.share_birthday AND p.id <> v_uid
         ORDER BY 1
         LIMIT 50
      ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_birthday_wish(_to uuid, _message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_year int := public.birthday_year_now();
  v_msg text := btrim(COALESCE(_message, ''));
  v_team boolean;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                  WHERE p.id = v_uid AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF char_length(v_msg) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'bad_message';
  END IF;
  IF _to = v_uid OR NOT EXISTS (SELECT 1 FROM public.birthday_ids_today() b WHERE b.id = _to) THEN
    RAISE EXCEPTION 'not_birthday';
  END IF;
  v_team := COALESCE(public.is_admin(v_uid), false);
  -- Members who turned sharing off can still be wished by the team.
  IF NOT v_team AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _to AND p.share_birthday) THEN
    RAISE EXCEPTION 'not_birthday';
  END IF;

  INSERT INTO public.birthday_wishes (birthday_user, year, from_user, message, from_team)
  VALUES (_to, v_year, v_uid, v_msg, v_team)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  -- Keep storage small: last year's wishes are enough.
  DELETE FROM public.birthday_wishes WHERE birthday_user = _to AND year < v_year - 1;

  SELECT COALESCE(NULLIF(p.display_name, ''), p.username, 'A member') INTO v_name
    FROM public.profiles p WHERE p.id = v_uid;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    _to,
    'birthday_wish',
    CASE WHEN v_team THEN '🎂 The AbiaConnect team sent you birthday wishes: “' || left(v_msg, 140) || '”'
         ELSE '🎂 ' || v_name || ' sent you birthday wishes: “' || left(v_msg, 140) || '”' END,
    '/'
  );
  RETURN jsonb_build_object('ok', true, 'already', false);
END;
$$;

-- The wishes a member received for this birthday (shown on their birthday card).
CREATE OR REPLACE FUNCTION public.my_birthday_wishes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(x.row ORDER BY x.from_team DESC, x.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT w.from_team, w.created_at,
             jsonb_build_object(
               'from_id', w.from_user,
               'name', CASE WHEN w.from_team THEN 'The AbiaConnect team'
                            ELSE COALESCE(NULLIF(p.display_name, ''), p.username, 'A member') END,
               'avatar_url', CASE WHEN w.from_team THEN NULL ELSE p.avatar_url END,
               'message', w.message,
               'from_team', w.from_team,
               'created_at', w.created_at
             ) AS row
        FROM public.birthday_wishes w
        LEFT JOIN public.profiles p ON p.id = w.from_user
       WHERE w.birthday_user = auth.uid()
         AND w.year = public.birthday_year_now()
         AND w.created_at > now() - interval '3 days'
       ORDER BY w.from_team DESC, w.created_at DESC
       LIMIT 200
    ) x;
$$;

CREATE OR REPLACE FUNCTION public.set_share_birthday(_on boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  UPDATE public.profiles SET share_birthday = COALESCE(_on, true) WHERE id = auth.uid();
  RETURN COALESCE(_on, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.birthdays_today() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_birthday_wish(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_birthday_wishes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_share_birthday(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.birthdays_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_birthday_wish(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_birthday_wishes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_share_birthday(boolean) TO authenticated;

-- When the daily greeting reaches a birthday member, tell their followers and
-- remind admins once a day. Rides on the existing greeting, so no new job.
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
           '/admin?section=birthdays'
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
REVOKE EXECUTE ON FUNCTION public.birthday_tell_community() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS birthday_tell_community ON public.notifications;
CREATE TRIGGER birthday_tell_community
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type = 'birthday')
  EXECUTE FUNCTION public.birthday_tell_community();

-- New members automatically follow the main admin (@Gabby). They can unfollow.
CREATE OR REPLACE FUNCTION public.follow_main_admin_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  BEGIN
    SELECT p.id INTO v_admin FROM public.profiles p WHERE lower(p.username) = 'gabby' LIMIT 1;
    IF v_admin IS NOT NULL AND v_admin <> NEW.id THEN
      INSERT INTO public.connect_follows (follower_id, followed_id)
      VALUES (NEW.id, v_admin)
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never stop someone joining.
    RAISE WARNING 'follow_main_admin_on_join: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.follow_main_admin_on_join() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS follow_main_admin_on_join ON public.profiles;
CREATE TRIGGER follow_main_admin_on_join
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.follow_main_admin_on_join();
