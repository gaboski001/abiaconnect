-- Volunteer team and community pages.
--
-- 1. Approving a volunteer switches on the right tools straight away (or when
--    they sign up with the same email), and tells them what they can now do.
--    Powers live in their own table, separate from the Admin / Member roles,
--    so a volunteer can never reach settings, money or other people's roles.
--      moderator          -> reported posts + community submissions
--      writer, social     -> community submissions (stories, events, Member of the Month)
--      connector          -> champion of their LGA group
--      developer, other   -> on the team; our people contact them
-- 2. Moderators hide reported posts (never delete), every action is logged,
--    and an admin (or the same moderator within a day) can undo it.
-- 3. Success stories, Member of the Month and events show only real content:
--    members send it in, the team reviews it.

-- ---------------------------------------------------------------------------
-- 1. Volunteer team
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.volunteer_team (
  user_id        uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('moderator', 'writer', 'social', 'developer', 'connector', 'other')),
  application_id uuid REFERENCES public.volunteer_applications(id) ON DELETE SET NULL,
  added_by       uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.volunteer_team ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_team FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.volunteer_team TO service_role;

ALTER TABLE public.volunteer_applications ADD COLUMN IF NOT EXISTS powers_granted_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.volunteer_team WHERE user_id = _user_id AND role = 'moderator')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_review_community(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.volunteer_team WHERE user_id = _user_id AND role IN ('moderator', 'writer', 'social'))
  )
$$;

-- What the signed-in member can do, for menus and pages.
CREATE OR REPLACE FUNCTION public.my_volunteer_powers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'role', (SELECT role FROM public.volunteer_team WHERE user_id = auth.uid()),
    'moderate', public.is_moderator(auth.uid()),
    'review', public.can_review_community(auth.uid())
  )
$$;

-- Switch on an approved application's tools for a member and tell them what
-- they can now do. Internal: called by volunteer_decide and claim_volunteer_powers.
CREATE OR REPLACE FUNCTION public.grant_volunteer_powers(_app_id uuid, _user uuid, _by uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.volunteer_applications;
  g_id uuid;
  g_name text;
  msg text;
  dest text;
BEGIN
  SELECT * INTO a FROM public.volunteer_applications WHERE id = _app_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'approved' OR a.powers_granted_at IS NOT NULL THEN RETURN NULL; END IF;
  IF _user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user) THEN RETURN NULL; END IF;

  -- Someone already moderating keeps that; otherwise the newest approved role counts.
  INSERT INTO public.volunteer_team AS vt (user_id, role, application_id, added_by)
  VALUES (_user, a.role, a.id, _by)
  ON CONFLICT (user_id) DO UPDATE
    SET role = CASE WHEN vt.role = 'moderator' THEN 'moderator' ELSE EXCLUDED.role END,
        application_id = EXCLUDED.application_id,
        added_by = EXCLUDED.added_by;

  UPDATE public.volunteer_applications SET user_id = _user, powers_granted_at = now() WHERE id = a.id;

  IF a.role = 'connector' AND a.lga IS NOT NULL THEN
    SELECT id, name INTO g_id, g_name FROM public.subgroups
     WHERE kind = 'lga' AND lower(lga) = lower(btrim(a.lga)) LIMIT 1;
    IF g_id IS NOT NULL THEN
      INSERT INTO public.group_champions (subgroup_id, user_id, added_by) VALUES (g_id, _user, _by) ON CONFLICT DO NOTHING;
      INSERT INTO public.subgroup_members (subgroup_id, user_id) VALUES (g_id, _user) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  msg := CASE a.role
    WHEN 'moderator' THEN 'Welcome to the team! You are now a Community Moderator. Open Moderator tools to review reported posts and what members send in.'
    WHEN 'writer' THEN 'Welcome to the team! You are now on the content team. Open Moderator tools to review and publish success stories, events and Member of the Month.'
    WHEN 'social' THEN 'Welcome to the team! You are now on the content team. Open Moderator tools to review and publish success stories, events and Member of the Month.'
    WHEN 'connector' THEN CASE WHEN g_id IS NOT NULL
      THEN 'Welcome to the team! You are now a Community Connector and a champion for ' || g_name || '. You will get an alert when someone new says hello there.'
      ELSE 'Welcome to the team! You are now a Community Connector. Our team will contact you about the group you will look after.' END
    ELSE 'Welcome to the AbiaConnect volunteer team! Our team will contact you about your first tasks.'
  END;
  dest := CASE
    WHEN a.role IN ('moderator', 'writer', 'social') THEN '/moderate'
    WHEN g_id IS NOT NULL THEN '/subgroups/' || g_id
    ELSE '/volunteer'
  END;
  INSERT INTO public.notifications (user_id, type, message, link) VALUES (_user, 'system', msg, dest);
  RETURN a.role;
END $$;

-- The application flow, now switching tools on when an application is approved.
CREATE OR REPLACE FUNCTION public.volunteer_decide(_id uuid, _decision text, _admin uuid, _note text DEFAULT NULL)
RETURNS public.volunteer_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.volunteer_applications;
  v_status text;
  v_user uuid;
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

  IF v_status = 'approved' THEN
    -- Their account: the one they applied from, or one with the same email.
    v_user := COALESCE(
      v_app.user_id,
      (SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(v_app.email) ORDER BY u.created_at LIMIT 1)
    );
    IF public.grant_volunteer_powers(v_app.id, v_user, _admin) IS NULL AND v_app.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (v_app.user_id, 'system', 'Good news: your volunteer application was approved. Please check your email for the next steps.', '/volunteer');
    END IF;
  ELSIF v_status = 'declined' AND v_app.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (v_app.user_id, 'system', 'There is an update on your volunteer application. Please check your email.', '/volunteer');
  END IF;

  SELECT * INTO v_app FROM public.volunteer_applications WHERE id = _id;
  RETURN v_app;
END;
$$;

-- Approved before they had an account: their tools switch on the first time
-- they sign in with the email they applied with.
CREATE OR REPLACE FUNCTION public.claim_volunteer_powers()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  my_email text;
  a record;
  got text;
  last text;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = uid;
  FOR a IN
    SELECT id, reviewed_by FROM public.volunteer_applications
     WHERE status = 'approved' AND powers_granted_at IS NULL
       AND (user_id = uid OR (my_email IS NOT NULL AND lower(email) = my_email))
     ORDER BY reviewed_at
  LOOP
    got := public.grant_volunteer_powers(a.id, uid, a.reviewed_by);
    IF got IS NOT NULL THEN last := got; END IF;
  END LOOP;
  RETURN last;
END $$;

-- Admin: the team, adding someone directly, and ending a role.
CREATE OR REPLACE FUNCTION public.admin_volunteer_team()
RETURNS TABLE (user_id uuid, display_name text, username text, avatar_url text, role text, created_at timestamptz, from_application boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT t.user_id, p.display_name, p.username, p.avatar_url, t.role, t.created_at, t.application_id IS NOT NULL
      FROM public.volunteer_team t JOIN public.profiles p ON p.id = t.user_id
     ORDER BY t.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_volunteer_role(_user uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_role text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501'; END IF;
  SELECT role INTO old_role FROM public.volunteer_team WHERE user_id = _user;

  IF _role IS NULL THEN
    IF old_role IS NULL THEN RETURN; END IF;
    DELETE FROM public.volunteer_team WHERE user_id = _user;
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (_user, 'system', 'Your volunteer role on AbiaConnect has ended. Thank you for everything you did for the community.', '/volunteer');
    RETURN;
  END IF;

  IF _role NOT IN ('moderator', 'writer', 'social', 'developer', 'connector', 'other') THEN
    RAISE EXCEPTION 'role_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user) THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF old_role = _role THEN RETURN; END IF;

  INSERT INTO public.volunteer_team (user_id, role, added_by) VALUES (_user, _role, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, added_by = EXCLUDED.added_by;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (_user, 'system',
    CASE _role
      WHEN 'moderator' THEN 'You are now a Community Moderator on AbiaConnect. Open Moderator tools to review reported posts and what members send in.'
      WHEN 'writer' THEN 'You are now on the AbiaConnect content team. Open Moderator tools to review and publish what members send in.'
      WHEN 'social' THEN 'You are now on the AbiaConnect content team. Open Moderator tools to review and publish what members send in.'
      ELSE 'You are now on the AbiaConnect volunteer team. Thank you!'
    END,
    CASE WHEN _role IN ('moderator', 'writer', 'social') THEN '/moderate' ELSE '/volunteer' END);
END $$;

-- ---------------------------------------------------------------------------
-- 2. Reported posts for moderators
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderator_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid NOT NULL,
  report_id    uuid,
  action       text NOT NULL CHECK (action IN ('hide', 'keep', 'restore')),
  target_type  text NOT NULL CHECK (target_type IN ('thread', 'reply')),
  target_id    uuid NOT NULL,
  excerpt      text,
  undone_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderator_actions_recent ON public.moderator_actions (created_at DESC);
ALTER TABLE public.moderator_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderator_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.moderator_actions TO service_role;

-- Plain text from stored post HTML, for short previews.
CREATE OR REPLACE FUNCTION public.mod_plain(_html text, _len int DEFAULT 400)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT left(btrim(regexp_replace(regexp_replace(coalesce(_html, ''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')), _len)
$$;

CREATE OR REPLACE FUNCTION public.mod_queue()
RETURNS TABLE (
  report_id uuid, reason text, reported_at timestamptz, target_type text, target_id uuid,
  thread_id uuid, title text, excerpt text, author_id uuid, author_name text, reports_on_post integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  admin boolean := public.is_admin(auth.uid());
BEGIN
  IF NOT public.is_moderator(me) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH r AS (
    SELECT rep.*,
           CASE WHEN rep.reply_id IS NOT NULL THEN 'reply' ELSE 'thread' END AS ttype,
           COALESCE(rep.reply_id, rep.thread_id) AS tid
      FROM public.reports rep
     WHERE rep.status = 'pending' AND (rep.reply_id IS NOT NULL OR rep.thread_id IS NOT NULL)
  )
  SELECT r.id, r.reason, r.created_at, r.ttype, r.tid,
         COALESCE(rp.thread_id, th.id),
         COALESCE(th.title, pt.title),
         public.mod_plain(COALESCE(rp.content, th.content)),
         CASE WHEN th.is_anonymous THEN NULL ELSE COALESCE(rp.user_id, th.user_id) END,
         CASE WHEN th.is_anonymous THEN 'Anonymous member' ELSE COALESCE(p.display_name, p.username, 'Member') END,
         (SELECT count(*)::int FROM r r2 WHERE r2.tid = r.tid)
    FROM r
    LEFT JOIN public.threads th ON r.ttype = 'thread' AND th.id = r.tid
    LEFT JOIN public.replies rp ON r.ttype = 'reply' AND rp.id = r.tid
    LEFT JOIN public.threads pt ON pt.id = rp.thread_id
    LEFT JOIN public.profiles p ON p.id = COALESCE(rp.user_id, th.user_id)
   WHERE (th.id IS NOT NULL OR rp.id IS NOT NULL)
     -- Nobody judges reports about their own posts (admins excepted).
     AND (admin OR COALESCE(rp.user_id, th.user_id, th.private_author_id) IS DISTINCT FROM me)
   ORDER BY r.created_at
   LIMIT 100;
END $$;

-- Hide (reversible) or keep a reported post. Also closes the other reports on the same post.
CREATE OR REPLACE FUNCTION public.mod_decide(_report uuid, _action text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  admin boolean := public.is_admin(auth.uid());
  rep public.reports;
  ttype text;
  tid uuid;
  author uuid;
  preview text;
  action_id uuid;
BEGIN
  IF NOT public.is_moderator(me) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF _action NOT IN ('hide', 'keep') THEN RAISE EXCEPTION 'action_invalid' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO rep FROM public.reports WHERE id = _report FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF rep.status <> 'pending' THEN RAISE EXCEPTION 'already_handled' USING ERRCODE = 'P0001'; END IF;

  IF rep.reply_id IS NOT NULL THEN
    ttype := 'reply'; tid := rep.reply_id;
    SELECT user_id, public.mod_plain(content, 200) INTO author, preview FROM public.replies WHERE id = tid;
  ELSE
    ttype := 'thread'; tid := rep.thread_id;
    SELECT COALESCE(user_id, private_author_id), left(title, 200) INTO author, preview FROM public.threads WHERE id = tid;
  END IF;
  IF tid IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF author = me AND NOT admin THEN RAISE EXCEPTION 'own_post' USING ERRCODE = 'P0001'; END IF;

  IF _action = 'hide' THEN
    -- A safety limit for volunteers; admins have none.
    IF NOT admin AND (SELECT count(*) FROM public.moderator_actions
                       WHERE moderator_id = me AND action = 'hide' AND created_at > now() - interval '1 day') >= 50 THEN
      RAISE EXCEPTION 'daily_limit' USING ERRCODE = 'P0001';
    END IF;
    IF ttype = 'reply' THEN
      UPDATE public.replies SET is_hidden = true WHERE id = tid;
    ELSE
      UPDATE public.threads SET is_deleted = true WHERE id = tid;
    END IF;
    UPDATE public.reports SET status = 'resolved'
     WHERE status = 'pending' AND (CASE WHEN ttype = 'reply' THEN reply_id = tid ELSE thread_id = tid AND reply_id IS NULL END);
    IF author IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (author, 'system',
        'One of your posts was hidden by a community moderator because it was reported and goes against our Community Standards. If you think this is a mistake, please tell us through Report a problem.',
        '/community-standards');
    END IF;
  ELSE
    UPDATE public.reports SET status = 'dismissed'
     WHERE status = 'pending' AND (CASE WHEN ttype = 'reply' THEN reply_id = tid ELSE thread_id = tid AND reply_id IS NULL END);
  END IF;

  INSERT INTO public.moderator_actions (moderator_id, report_id, action, target_type, target_id, excerpt)
  VALUES (me, rep.id, _action, ttype, tid, preview)
  RETURNING id INTO action_id;
  RETURN action_id;
END $$;

-- Put a hidden post back. Admins any time; the moderator who hid it, within a day.
CREATE OR REPLACE FUNCTION public.mod_undo(_action uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  act public.moderator_actions;
  author uuid;
BEGIN
  IF NOT public.is_moderator(me) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO act FROM public.moderator_actions WHERE id = _action FOR UPDATE;
  IF NOT FOUND OR act.action <> 'hide' THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
  IF act.undone_at IS NOT NULL THEN RAISE EXCEPTION 'already_undone' USING ERRCODE = 'P0001'; END IF;
  IF NOT public.is_admin(me) AND (act.moderator_id <> me OR act.created_at < now() - interval '1 day') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF act.target_type = 'reply' THEN
    UPDATE public.replies SET is_hidden = false WHERE id = act.target_id RETURNING user_id INTO author;
  ELSE
    UPDATE public.threads SET is_deleted = false WHERE id = act.target_id RETURNING COALESCE(user_id, private_author_id) INTO author;
  END IF;
  UPDATE public.moderator_actions SET undone_at = now() WHERE id = act.id;
  INSERT INTO public.moderator_actions (moderator_id, report_id, action, target_type, target_id, excerpt)
  VALUES (me, act.report_id, 'restore', act.target_type, act.target_id, act.excerpt);
  IF author IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (author, 'system', 'Good news: after a second look, your post is visible again. Sorry for the trouble.', '/notifications');
  END IF;
END $$;

-- Recent actions: a moderator sees their own, an admin sees everyone's.
CREATE OR REPLACE FUNCTION public.mod_recent_actions(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, moderator_id uuid, moderator_name text, action text, target_type text, target_id uuid,
  thread_id uuid, excerpt text, undone_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF NOT public.is_moderator(me) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT a.id, a.moderator_id, COALESCE(p.display_name, p.username, 'Moderator'), a.action, a.target_type, a.target_id,
           CASE WHEN a.target_type = 'reply' THEN (SELECT r.thread_id FROM public.replies r WHERE r.id = a.target_id) ELSE a.target_id END,
           a.excerpt, a.undone_at, a.created_at
      FROM public.moderator_actions a
      LEFT JOIN public.profiles p ON p.id = a.moderator_id
     WHERE public.is_admin(me) OR a.moderator_id = me
     ORDER BY a.created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Community pages: success stories, Member of the Month, events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.success_stories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL CHECK (char_length(title) BETWEEN 8 AND 140),
  story        text NOT NULL CHECK (char_length(story) BETWEEN 80 AND 4000),
  tag          text NOT NULL CHECK (tag IN ('Business', 'Education', 'Community', 'Health', 'Sports', 'Arts', 'Diaspora', 'Other')),
  person_name  text CHECK (person_name IS NULL OR char_length(person_name) <= 80),
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'declined', 'removed')),
  review_note  text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.spotlight_nominations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nominee_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (char_length(reason) BETWEEN 30 AND 1000),
  nominated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'featured', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.member_spotlights (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month      date NOT NULL UNIQUE,
  headline   text NOT NULL CHECK (char_length(headline) BETWEEN 10 AND 140),
  about      text NOT NULL CHECK (char_length(about) BETWEEN 40 AND 1500),
  quote      text CHECK (quote IS NULL OR char_length(quote) <= 300),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL CHECK (char_length(title) BETWEEN 6 AND 120),
  description  text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz,
  place        text CHECK (place IS NULL OR char_length(place) <= 160),
  online_link  text CHECK (online_link IS NULL OR (online_link ~ '^https://' AND char_length(online_link) <= 500)),
  lga          text CHECK (lga IS NULL OR char_length(lga) <= 60),
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'declined', 'removed')),
  review_note  text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (place IS NOT NULL OR online_link IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS community_events_upcoming ON public.community_events (starts_at) WHERE status = 'published';

-- Everything is read and written through the functions below.
ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotlight_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_spotlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.success_stories, public.spotlight_nominations, public.member_spotlights, public.community_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.success_stories, public.spotlight_nominations, public.member_spotlights, public.community_events
  TO service_role;

CREATE OR REPLACE FUNCTION public.community_require_member()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign_in' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND COALESCE(is_banned, false)) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION public.submit_success_story(_title text, _story text, _tag text, _person text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.community_require_member();
  new_id uuid;
BEGIN
  IF (SELECT count(*) FROM public.success_stories WHERE submitted_by = uid AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'too_many_waiting' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(coalesce(_title, ''))) NOT BETWEEN 8 AND 140 THEN RAISE EXCEPTION 'title_invalid' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(_story, ''))) NOT BETWEEN 80 AND 4000 THEN RAISE EXCEPTION 'story_invalid' USING ERRCODE = 'P0001'; END IF;
  IF _tag NOT IN ('Business', 'Education', 'Community', 'Health', 'Sports', 'Arts', 'Diaspora', 'Other') THEN
    RAISE EXCEPTION 'tag_invalid' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.success_stories (title, story, tag, person_name, submitted_by)
  VALUES (btrim(_title), btrim(_story), _tag, NULLIF(left(btrim(coalesce(_person, '')), 80), ''), uid)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.submit_spotlight_nomination(_username text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.community_require_member();
  nominee uuid;
  new_id uuid;
BEGIN
  SELECT id INTO nominee FROM public.profiles
   WHERE lower(username) = lower(btrim(regexp_replace(coalesce(_username, ''), '^\s*@', '')))
     AND NOT COALESCE(is_banned, false) AND NOT COALESCE(is_deleted, false)
   LIMIT 1;
  IF nominee IS NULL THEN RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0001'; END IF;
  IF nominee = uid THEN RAISE EXCEPTION 'not_yourself' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(_reason, ''))) NOT BETWEEN 30 AND 1000 THEN RAISE EXCEPTION 'reason_invalid' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.spotlight_nominations WHERE nominated_by = uid AND nominee_id = nominee AND status = 'pending') THEN
    RAISE EXCEPTION 'already_nominated' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.spotlight_nominations WHERE nominated_by = uid AND created_at > now() - interval '30 days') >= 5 THEN
    RAISE EXCEPTION 'too_many_waiting' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.spotlight_nominations (nominee_id, reason, nominated_by) VALUES (nominee, btrim(_reason), uid)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.submit_community_event(
  _title text, _description text, _starts timestamptz, _ends timestamptz DEFAULT NULL,
  _place text DEFAULT NULL, _link text DEFAULT NULL, _lga text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.community_require_member();
  new_id uuid;
  place text := NULLIF(left(btrim(coalesce(_place, '')), 160), '');
  link text := NULLIF(btrim(coalesce(_link, '')), '');
BEGIN
  IF (SELECT count(*) FROM public.community_events WHERE submitted_by = uid AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'too_many_waiting' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(coalesce(_title, ''))) NOT BETWEEN 6 AND 120 THEN RAISE EXCEPTION 'title_invalid' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(_description, ''))) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION 'description_invalid' USING ERRCODE = 'P0001'; END IF;
  IF _starts IS NULL OR _starts < now() OR _starts > now() + interval '1 year' THEN RAISE EXCEPTION 'date_invalid' USING ERRCODE = 'P0001'; END IF;
  IF _ends IS NOT NULL AND _ends <= _starts THEN RAISE EXCEPTION 'end_invalid' USING ERRCODE = 'P0001'; END IF;
  IF link IS NOT NULL AND (link !~ '^https://' OR char_length(link) > 500) THEN RAISE EXCEPTION 'link_invalid' USING ERRCODE = 'P0001'; END IF;
  IF place IS NULL AND link IS NULL THEN RAISE EXCEPTION 'place_missing' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.community_events (title, description, starts_at, ends_at, place, online_link, lga, submitted_by)
  VALUES (btrim(_title), btrim(_description), _starts, _ends, place, link, NULLIF(left(btrim(coalesce(_lga, '')), 60), ''), uid)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- Public reading.
CREATE OR REPLACE FUNCTION public.list_success_stories(_limit int DEFAULT 50)
RETURNS TABLE (id uuid, title text, story text, tag text, person_name text, published_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.title, s.story, s.tag, s.person_name, COALESCE(s.reviewed_at, s.created_at)
    FROM public.success_stories s
   WHERE s.status = 'published'
   ORDER BY COALESCE(s.reviewed_at, s.created_at) DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 100)
$$;

CREATE OR REPLACE FUNCTION public.list_member_spotlights()
RETURNS TABLE (
  id uuid, member_id uuid, display_name text, username text, avatar_url text, lga text,
  member_since timestamptz, month date, headline text, about text, quote text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.member_id, COALESCE(p.display_name, p.username, 'Member'), p.username, p.avatar_url, p.lga,
         p.created_at, s.month, s.headline, s.about, s.quote
    FROM public.member_spotlights s
    JOIN public.profiles p ON p.id = s.member_id
   WHERE NOT COALESCE(p.is_banned, false) AND NOT COALESCE(p.is_deleted, false)
   ORDER BY s.month DESC
   LIMIT 13
$$;

CREATE OR REPLACE FUNCTION public.list_upcoming_events()
RETURNS TABLE (
  id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz,
  place text, online_link text, lga text, organiser_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.place, e.online_link, e.lga,
         COALESCE(p.display_name, p.username)
    FROM public.community_events e
    LEFT JOIN public.profiles p ON p.id = e.submitted_by
   WHERE e.status = 'published' AND COALESCE(e.ends_at, e.starts_at + interval '6 hours') > now()
   ORDER BY e.starts_at
   LIMIT 100
$$;

-- What the signed-in member has sent in, with where it stands.
CREATE OR REPLACE FUNCTION public.my_community_submissions()
RETURNS TABLE (kind text, id uuid, title text, status text, review_note text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'story', id, title, status, review_note, created_at FROM public.success_stories WHERE submitted_by = auth.uid()
  UNION ALL
  SELECT 'event', id, title, status, review_note, created_at FROM public.community_events WHERE submitted_by = auth.uid()
  UNION ALL
  SELECT 'nomination', n.id, COALESCE(p.display_name, p.username, 'Member'), n.status, NULL, n.created_at
    FROM public.spotlight_nominations n JOIN public.profiles p ON p.id = n.nominee_id
   WHERE n.nominated_by = auth.uid()
  ORDER BY 6 DESC
  LIMIT 30
$$;

-- The review queue for the team.
CREATE OR REPLACE FUNCTION public.community_review_queue()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_review_community(auth.uid()) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'stories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'story', s.story, 'tag', s.tag, 'person_name', s.person_name, 'status', s.status,
        'created_at', s.created_at, 'submitted_by', s.submitted_by, 'submitter', COALESCE(p.display_name, p.username)
      ) ORDER BY s.created_at)
        FROM public.success_stories s LEFT JOIN public.profiles p ON p.id = s.submitted_by
       WHERE s.status IN ('pending', 'published')), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'description', e.description, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
        'place', e.place, 'online_link', e.online_link, 'lga', e.lga, 'status', e.status, 'created_at', e.created_at,
        'submitted_by', e.submitted_by, 'submitter', COALESCE(p.display_name, p.username)
      ) ORDER BY e.starts_at)
        FROM public.community_events e LEFT JOIN public.profiles p ON p.id = e.submitted_by
       WHERE e.status = 'pending' OR (e.status = 'published' AND COALESCE(e.ends_at, e.starts_at) > now() - interval '1 day')), '[]'::jsonb),
    'nominations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id, 'reason', n.reason, 'created_at', n.created_at,
        'nominee_id', n.nominee_id, 'nominee', COALESCE(np.display_name, np.username), 'nominee_username', np.username,
        'nominator', COALESCE(bp.display_name, bp.username)
      ) ORDER BY n.created_at)
        FROM public.spotlight_nominations n
        JOIN public.profiles np ON np.id = n.nominee_id
        LEFT JOIN public.profiles bp ON bp.id = n.nominated_by
       WHERE n.status = 'pending'), '[]'::jsonb),
    'spotlights', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'month', s.month, 'headline', s.headline, 'member', COALESCE(p.display_name, p.username)
      ) ORDER BY s.month DESC)
        FROM public.member_spotlights s JOIN public.profiles p ON p.id = s.member_id), '[]'::jsonb)
  );
END $$;

-- publish / decline a waiting story or event, remove a published one, or dismiss a nomination.
CREATE OR REPLACE FUNCTION public.review_community_item(_kind text, _id uuid, _decision text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  cur text;
  owner uuid;
  ttl text;
  next_status text;
  note text := NULLIF(left(btrim(coalesce(_note, '')), 500), '');
  page text := CASE _kind WHEN 'story' THEN '/success-stories' ELSE '/events' END;
  what text := CASE _kind WHEN 'story' THEN 'success story' ELSE 'event' END;
BEGIN
  IF NOT public.can_review_community(me) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;

  IF _kind = 'nomination' THEN
    IF _decision <> 'dismiss' THEN RAISE EXCEPTION 'decision_invalid' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.spotlight_nominations SET status = 'dismissed' WHERE id = _id AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
    RETURN;
  END IF;
  IF _kind NOT IN ('story', 'event') THEN RAISE EXCEPTION 'kind_invalid' USING ERRCODE = 'P0001'; END IF;

  IF _kind = 'story' THEN
    SELECT status, submitted_by, title INTO cur, owner, ttl FROM public.success_stories WHERE id = _id FOR UPDATE;
  ELSE
    SELECT status, submitted_by, title INTO cur, owner, ttl FROM public.community_events WHERE id = _id FOR UPDATE;
  END IF;
  IF cur IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;

  next_status := CASE
    WHEN _decision = 'publish' AND cur = 'pending' THEN 'published'
    WHEN _decision = 'decline' AND cur = 'pending' THEN 'declined'
    WHEN _decision = 'remove' AND cur = 'published' THEN 'removed'
  END;
  IF next_status IS NULL THEN RAISE EXCEPTION 'decision_invalid' USING ERRCODE = 'P0001'; END IF;

  IF _kind = 'story' THEN
    UPDATE public.success_stories SET status = next_status, review_note = note, reviewed_by = me, reviewed_at = now() WHERE id = _id;
  ELSE
    UPDATE public.community_events SET status = next_status, review_note = note, reviewed_by = me, reviewed_at = now() WHERE id = _id;
  END IF;

  IF owner IS NOT NULL AND owner <> me THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (owner, 'system',
      CASE next_status
        WHEN 'published' THEN 'Your ' || what || ' "' || left(ttl, 80) || '" is now live on AbiaConnect. Thank you for sharing!'
        WHEN 'declined' THEN 'Thank you for your ' || what || ' "' || left(ttl, 80) || '". We could not publish it this time.' || COALESCE(' Note from the team: ' || note, '')
        ELSE 'Your ' || what || ' "' || left(ttl, 80) || '" has been taken down.' || COALESCE(' Note from the team: ' || note, '')
      END,
      page);
  END IF;
END $$;

-- Make a member Member of the Month (replaces this month's, if any).
CREATE OR REPLACE FUNCTION public.publish_member_spotlight(
  _member uuid, _headline text, _about text, _quote text DEFAULT NULL, _nomination uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  this_month date := date_trunc('month', now() AT TIME ZONE 'Africa/Lagos')::date;
  new_id uuid;
BEGIN
  IF NOT public.can_review_community(me) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _member AND NOT COALESCE(is_banned, false) AND NOT COALESCE(is_deleted, false)) THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(btrim(coalesce(_headline, ''))) NOT BETWEEN 10 AND 140 THEN RAISE EXCEPTION 'headline_invalid' USING ERRCODE = 'P0001'; END IF;
  IF char_length(btrim(coalesce(_about, ''))) NOT BETWEEN 40 AND 1500 THEN RAISE EXCEPTION 'about_invalid' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.member_spotlights (member_id, month, headline, about, quote, created_by)
  VALUES (_member, this_month, btrim(_headline), btrim(_about), NULLIF(left(btrim(coalesce(_quote, '')), 300), ''), me)
  ON CONFLICT (month) DO UPDATE
    SET member_id = EXCLUDED.member_id, headline = EXCLUDED.headline, about = EXCLUDED.about,
        quote = EXCLUDED.quote, created_by = EXCLUDED.created_by, created_at = now()
  RETURNING id INTO new_id;

  IF _nomination IS NOT NULL THEN
    UPDATE public.spotlight_nominations SET status = 'featured' WHERE id = _nomination;
  END IF;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (_member, 'system', 'Congratulations! You are AbiaConnect''s Member of the Month. See your spotlight.', '/member-spotlight');
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_member_spotlight(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_review_community(auth.uid()) THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.member_spotlights WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001'; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.grant_volunteer_powers(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.volunteer_decide(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.community_require_member() FROM PUBLIC, anon, authenticated;
-- Used inside the functions below; not callable directly (would show who is on the team).
REVOKE EXECUTE ON FUNCTION public.is_moderator(uuid), public.can_review_community(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_volunteer_powers(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.volunteer_decide(uuid, text, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION
  public.my_volunteer_powers(),
  public.claim_volunteer_powers(), public.admin_volunteer_team(), public.admin_set_volunteer_role(uuid, text),
  public.mod_queue(), public.mod_decide(uuid, text), public.mod_undo(uuid), public.mod_recent_actions(int),
  public.submit_success_story(text, text, text, text), public.submit_spotlight_nomination(text, text),
  public.submit_community_event(text, text, timestamptz, timestamptz, text, text, text),
  public.my_community_submissions(), public.community_review_queue(),
  public.review_community_item(text, uuid, text, text),
  public.publish_member_spotlight(uuid, text, text, text, uuid), public.remove_member_spotlight(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.my_volunteer_powers(),
  public.claim_volunteer_powers(), public.admin_volunteer_team(), public.admin_set_volunteer_role(uuid, text),
  public.mod_queue(), public.mod_decide(uuid, text), public.mod_undo(uuid), public.mod_recent_actions(int),
  public.submit_success_story(text, text, text, text), public.submit_spotlight_nomination(text, text),
  public.submit_community_event(text, text, timestamptz, timestamptz, text, text, text),
  public.my_community_submissions(), public.community_review_queue(),
  public.review_community_item(text, uuid, text, text),
  public.publish_member_spotlight(uuid, text, text, text, uuid), public.remove_member_spotlight(uuid)
TO authenticated;

-- The three public pages work for visitors too.
GRANT EXECUTE ON FUNCTION public.list_success_stories(int), public.list_member_spotlights(), public.list_upcoming_events()
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
