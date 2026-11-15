-- The public Team page (/team) shows the real volunteer team.
--
-- 1. Every approved volunteer appears on /team with their name, photo, role
--    and a short intro. Until an admin writes one, the intro is a friendly
--    line about their role.
-- 2. Admins can edit the intro or hide someone from the page. Removing a
--    volunteer from the team (admin_set_volunteer_role with NULL) also takes
--    them off the page, because the page reads volunteer_team directly.
-- 3. The page only ever shows name, username, photo, role and intro: never
--    email, phone, LGA or application answers.

ALTER TABLE public.volunteer_team
  ADD COLUMN IF NOT EXISTS intro text,
  ADD COLUMN IF NOT EXISTS show_on_team boolean NOT NULL DEFAULT true;

-- The intro shown when an admin has not written one yet.
CREATE OR REPLACE FUNCTION public.team_default_intro(_role text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _role
    WHEN 'moderator' THEN 'Keeps our discussions friendly and safe by reviewing reported posts.'
    WHEN 'writer' THEN 'Helps share members'' success stories, events and Member of the Month.'
    WHEN 'social' THEN 'Helps tell the AbiaConnect story on social media and shares members'' success stories.'
    WHEN 'connector' THEN 'Welcomes new members and helps their local group grow.'
    WHEN 'developer' THEN 'Helps build and improve the AbiaConnect website and app.'
    ELSE 'Gives time and skills to help the AbiaConnect community grow.'
  END
$$;

-- Anyone, signed in or not: the team as shown on /team, oldest member first.
CREATE OR REPLACE FUNCTION public.public_team()
RETURNS TABLE (display_name text, username text, avatar_url text, role text, intro text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), p.username, 'Volunteer'),
         p.username,
         p.avatar_url,
         t.role,
         COALESCE(NULLIF(btrim(t.intro), ''), public.team_default_intro(t.role)),
         t.created_at
    FROM public.volunteer_team t
    JOIN public.profiles p ON p.id = t.user_id
   WHERE t.show_on_team
   ORDER BY t.created_at, p.id
$$;
REVOKE ALL ON FUNCTION public.public_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_team() TO anon, authenticated, service_role;

-- Admin: the team list now includes the intro and whether they show on /team.
DROP FUNCTION IF EXISTS public.admin_volunteer_team();
CREATE FUNCTION public.admin_volunteer_team()
RETURNS TABLE (
  user_id uuid, display_name text, username text, avatar_url text, role text, created_at timestamptz,
  from_application boolean, intro text, show_on_team boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT t.user_id, p.display_name, p.username, p.avatar_url, t.role, t.created_at,
           t.application_id IS NOT NULL, t.intro, t.show_on_team
      FROM public.volunteer_team t JOIN public.profiles p ON p.id = t.user_id
     ORDER BY t.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_volunteer_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_volunteer_team() TO authenticated, service_role;

-- Admin: write the intro (empty = use the role's line) and show or hide on /team.
CREATE OR REPLACE FUNCTION public.admin_set_team_profile(_user uuid, _intro text, _show boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean text := NULLIF(btrim(regexp_replace(coalesce(_intro, ''), '\s+', ' ', 'g')), '');
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501'; END IF;
  IF length(coalesce(clean, '')) > 300 THEN RAISE EXCEPTION 'intro_too_long' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.volunteer_team
     SET intro = clean, show_on_team = COALESCE(_show, show_on_team)
   WHERE user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_team_profile(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_team_profile(uuid, text, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';