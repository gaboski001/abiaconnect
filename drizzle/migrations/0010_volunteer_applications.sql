-- Volunteer applications.
--
-- The "Want to Contribute?" form on the website (page /volunteer) saves an
-- application here. Admins review them in Admin -> Volunteer Applications and
-- approve, decline or ignore each one. The applicant gets an email when the
-- application arrives and again when it is approved or declined.
--
-- The table is written by two server functions only:
--   volunteer_submit()  - called by the volunteer-apply edge function
--   volunteer_decide()  - called by the volunteer-decide edge function (admins)

CREATE TABLE IF NOT EXISTS public.volunteer_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The member's account, when they applied while signed in.
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name          text NOT NULL,
  email              text NOT NULL,
  phone              text,
  location           text NOT NULL,
  lga                text,
  role               text NOT NULL CHECK (role IN ('moderator', 'writer', 'social', 'developer', 'connector', 'other')),
  hours_per_week     text NOT NULL,
  motivation         text NOT NULL,
  experience         text NOT NULL,
  links              text,
  -- The questions for the chosen role with the applicant's answers:
  -- [{"question": "...", "answer": "..."}]
  answers            jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'ignored')),
  -- The admin's personal note, included in the decision email.
  admin_note         text,
  reviewed_by        uuid,
  reviewed_at        timestamptz,
  decision_emailed_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS volunteer_applications_status_idx ON public.volunteer_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_applications_email_idx ON public.volunteer_applications (lower(email));

ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read volunteer applications" ON public.volunteer_applications;
CREATE POLICY "Admins read volunteer applications"
  ON public.volunteer_applications FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.volunteer_applications FROM anon, authenticated;
GRANT SELECT ON public.volunteer_applications TO authenticated;

-- ---------------------------------------------------------------------------
-- Save a new application (service role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.volunteer_submit(
  _full_name text,
  _email text,
  _phone text,
  _location text,
  _lga text,
  _role text,
  _hours_per_week text,
  _motivation text,
  _experience text,
  _links text,
  _answers jsonb,
  _user uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(_full_name, ''));
  v_email text := lower(btrim(coalesce(_email, '')));
  v_location text := btrim(coalesce(_location, ''));
  v_hours text := btrim(coalesce(_hours_per_week, ''));
  v_motivation text := btrim(coalesce(_motivation, ''));
  v_experience text := btrim(coalesce(_experience, ''));
  v_answers jsonb := coalesce(_answers, '[]'::jsonb);
  v_id uuid;
BEGIN
  IF length(v_name) < 2 OR length(v_name) > 80 THEN RAISE EXCEPTION 'name_invalid' USING ERRCODE = 'P0001'; END IF;
  IF length(v_email) > 255 OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'email_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF _role IS NULL OR _role NOT IN ('moderator', 'writer', 'social', 'developer', 'connector', 'other') THEN
    RAISE EXCEPTION 'role_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_location) < 2 OR length(v_location) > 120 OR length(v_hours) < 1 OR length(v_hours) > 40
     OR length(coalesce(_phone, '')) > 30 OR length(coalesce(_lga, '')) > 60 OR length(coalesce(_links, '')) > 500 THEN
    RAISE EXCEPTION 'details_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_motivation) < 30 OR length(v_motivation) > 2000 OR length(v_experience) < 30 OR length(v_experience) > 2000 THEN
    RAISE EXCEPTION 'text_invalid' USING ERRCODE = 'P0001';
  END IF;
  -- Up to 6 question/answer pairs, text only.
  IF jsonb_typeof(v_answers) <> 'array' OR jsonb_array_length(v_answers) > 6 OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_answers) a
       WHERE jsonb_typeof(a) <> 'object'
          OR jsonb_typeof(a -> 'question') IS DISTINCT FROM 'string'
          OR jsonb_typeof(a -> 'answer') IS DISTINCT FROM 'string'
          OR length(a ->> 'question') > 300 OR length(a ->> 'answer') > 2000
          OR (SELECT count(*) FROM jsonb_object_keys(a)) <> 2) THEN
    RAISE EXCEPTION 'answers_invalid' USING ERRCODE = 'P0001';
  END IF;

  -- One application under review per email, and at most 3 in 30 days.
  IF EXISTS (SELECT 1 FROM public.volunteer_applications v WHERE lower(v.email) = v_email AND v.status = 'pending') THEN
    RAISE EXCEPTION 'already_pending' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.volunteer_applications v
       WHERE lower(v.email) = v_email AND v.created_at > now() - interval '30 days') >= 3 THEN
    RAISE EXCEPTION 'too_many' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.volunteer_applications
    (user_id, full_name, email, phone, location, lga, role, hours_per_week, motivation, experience, links, answers)
  VALUES
    (_user, v_name, v_email, NULLIF(btrim(coalesce(_phone, '')), ''), v_location, NULLIF(btrim(coalesce(_lga, '')), ''),
     _role, v_hours, v_motivation, v_experience, NULLIF(btrim(coalesce(_links, '')), ''), v_answers)
  RETURNING id INTO v_id;

  -- Tell the admins, and the applicant when they have an account.
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT r.user_id, 'system', 'New volunteer application from ' || v_name || '. Review it in Admin, Volunteer Applications.',
         '/admin/dashboard'
  FROM (SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role::text IN ('Admin', 'Super Admin')) r;
  IF _user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (_user, 'system', 'We received your volunteer application. We will review it and let you know by email.', '/volunteer');
  END IF;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.volunteer_submit(text, text, text, text, text, text, text, text, text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.volunteer_submit(text, text, text, text, text, text, text, text, text, text, jsonb, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Approve, decline or ignore an application (service role only; the edge
-- function passes the signed-in admin, who is checked again here)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.volunteer_decide(_id uuid, _decision text, _admin uuid, _note text DEFAULT NULL)
RETURNS public.volunteer_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.volunteer_applications;
  v_status text;
BEGIN
  IF _admin IS NULL OR NOT public.is_admin(_admin) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501'; END IF;
  v_status := CASE _decision WHEN 'approve' THEN 'approved' WHEN 'decline' THEN 'declined' WHEN 'ignore' THEN 'ignored' END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'decision_invalid' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(_note, '')) > 1000 THEN RAISE EXCEPTION 'note_too_long' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_app FROM public.volunteer_applications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  -- An emailed decision is final; an ignored application can still be decided.
  IF v_app.status IN ('approved', 'declined') THEN RAISE EXCEPTION 'already_decided' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.volunteer_applications
     SET status = v_status, admin_note = NULLIF(btrim(coalesce(_note, '')), ''), reviewed_by = _admin, reviewed_at = now()
   WHERE id = _id
  RETURNING * INTO v_app;

  IF v_app.user_id IS NOT NULL AND v_status IN ('approved', 'declined') THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (v_app.user_id, 'system',
            CASE v_status WHEN 'approved'
              THEN 'Good news: your volunteer application was approved. Please check your email for the next steps.'
              ELSE 'There is an update on your volunteer application. Please check your email.' END,
            '/volunteer');
  END IF;
  RETURN v_app;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.volunteer_decide(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.volunteer_decide(uuid, text, uuid, text) TO service_role;