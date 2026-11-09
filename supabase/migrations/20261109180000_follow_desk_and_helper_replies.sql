-- 1. Every member follows @Gabby and the AbiaConnect Newsdesk (existing members
--    now, new members when they join). No "started following you" alerts.
-- 2. The Newsdesk profile looks like an official news desk (picture, bio, place).
-- 3. Newsdesk posts take turns between the Newsdesk and @Gabby (everyday forums
--    only; sensitive forums stay with the Newsdesk).
-- 4. Helper replies: while switched on (Admin -> Helper replies), accounts the
--    admin picks reply to new posts so conversations get going. At most two per
--    post, never overnight, never in sensitive forums. Off by default. Runs inside
--    the existing hourly job, so no new scheduled job.

-- ---- 1. Follows -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.main_accounts_to_follow()
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p WHERE lower(p.username) = 'gabby'
  UNION
  SELECT s.author_id FROM public.newsdesk_settings s WHERE s.id AND s.author_id IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.main_accounts_to_follow() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.follow_main_admin_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.connect_follows (follower_id, followed_id)
    SELECT NEW.id, m.id FROM public.main_accounts_to_follow() m WHERE m.id <> NEW.id
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never stop someone joining.
    RAISE WARNING 'follow_main_admin_on_join: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

INSERT INTO public.connect_follows (follower_id, followed_id)
SELECT p.id, m.id
  FROM public.profiles p
 CROSS JOIN public.main_accounts_to_follow() m
 WHERE p.id <> m.id AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
ON CONFLICT DO NOTHING;

-- ---- 2. The Newsdesk profile -----------------------------------------------
UPDATE public.profiles p
   SET display_name = 'AbiaConnect Newsdesk',
       avatar_url = 'https://abiaconnect.com/newsdesk-avatar.png',
       bio = 'The official news desk of AbiaConnect. Daily news from Abia State and Abians at home and abroad, with a question to get everyone talking. Share a story: support@abiaconnect.com',
       occupation = 'News and editorial desk',
       current_location = 'Umuahia, Abia State'
  FROM public.newsdesk_settings s
 WHERE s.id AND p.id = s.author_id;

-- ---- 3. Newsdesk and @Gabby take turns --------------------------------------
ALTER TABLE public.newsdesk_settings ADD COLUMN IF NOT EXISTS alternate_author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.newsdesk_settings ADD COLUMN IF NOT EXISTS alternate_next boolean NOT NULL DEFAULT false;
UPDATE public.newsdesk_settings
   SET alternate_author_id = (SELECT p.id FROM public.profiles p WHERE lower(p.username) = 'gabby' LIMIT 1)
 WHERE id;

CREATE OR REPLACE FUNCTION public.newsdesk_take_turns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_turn boolean;
BEGIN
  -- Only the Newsdesk job posts with no signed-in member (it uses the service key).
  IF auth.uid() IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO s FROM public.newsdesk_settings WHERE id;
  IF s.author_id IS NULL OR s.alternate_author_id IS NULL
     OR COALESCE(NEW.author_id, NEW.user_id) IS DISTINCT FROM s.author_id
     OR 'welcome' = ANY (COALESCE(NEW.tags, '{}'))
     OR EXISTS (SELECT 1 FROM public.categories c
                 WHERE c.id = NEW.category_id AND c.slug = ANY (COALESCE(s.review_slugs, '{}'))) THEN
    RETURN NEW;
  END IF;
  UPDATE public.newsdesk_settings SET alternate_next = NOT alternate_next WHERE id
  RETURNING NOT alternate_next INTO v_turn;
  IF v_turn THEN
    NEW.author_id := s.alternate_author_id;
    NEW.user_id := s.alternate_author_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.newsdesk_take_turns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS newsdesk_take_turns ON public.threads;
CREATE TRIGGER newsdesk_take_turns
  BEFORE INSERT ON public.threads
  FOR EACH ROW
  EXECUTE FUNCTION public.newsdesk_take_turns();

-- ---- 4. Helper replies -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.helper_reply_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  per_hour integer NOT NULL DEFAULT 10 CHECK (per_hour BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.helper_reply_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.helper_reply_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.helper_reply_lines (
  id serial PRIMARY KEY,
  line text NOT NULL UNIQUE
);
-- {name} is the poster's first name, {place} the group or forum.
INSERT INTO public.helper_reply_lines (line) VALUES
  ('Thank you for sharing this, {name}. I''d love to hear more about it.'),
  ('Good one, {name}! What do others in {place} think about this?'),
  ('Nnọọ {name}! This is worth talking about. How did it go for you?'),
  ('Well said, {name}. Anyone with more information on this, please share 👏🏾'),
  ('Interesting point, {name}. What made you think about this?'),
  ('Thanks for starting this conversation, {name}. Let''s keep it going.'),
  ('Thanks {name}. Has anyone else here had the same experience?'),
  ('This is helpful, {name}. Daalụ for posting it 🙏🏾'),
  ('Nice one, {name}! Who else in {place} has a view on this?'),
  ('Ezigbo okwu, {name}. Please tell us a bit more.')
ON CONFLICT (line) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.helper_replies (
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reply_id uuid,
  line_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS helper_replies_created_idx ON public.helper_replies (created_at);

ALTER TABLE public.helper_reply_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_reply_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_reply_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helper_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.helper_reply_settings, public.helper_reply_accounts, public.helper_reply_lines, public.helper_replies
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.html_text(_s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT replace(replace(replace(COALESCE(_s, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') $$;

-- Helpers rest overnight (23:00-07:00 Lagos), like real people.
CREATE OR REPLACE FUNCTION public.helper_replies_resting()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT extract(hour FROM (now() AT TIME ZONE 'Africa/Lagos'))::int NOT BETWEEN 7 AND 22 $$;

CREATE OR REPLACE FUNCTION public.run_helper_replies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st record;
  t record;
  v_helper uuid;
  v_line text;
  v_line_id integer;
  v_name text;
  v_place text;
  v_reply uuid;
  v_review text[];
  sent integer := 0;
BEGIN
  SELECT * INTO st FROM public.helper_reply_settings WHERE id;
  IF NOT COALESCE(st.enabled, false) OR public.helper_replies_resting() THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(review_slugs, '{}') INTO v_review FROM public.newsdesk_settings WHERE id;
  v_review := COALESCE(v_review, '{}');

  FOR t IN
    SELECT th.id, COALESCE(th.author_id, th.user_id) AS author, th.is_anonymous, th.subgroup_id, th.category_id,
           (SELECT count(*) FROM public.helper_replies h WHERE h.thread_id = th.id) AS helped
      FROM public.threads th
     WHERE NOT th.is_deleted AND COALESCE(th.allow_replies, true)
       AND th.created_at > now() - interval '2 days'
       AND th.created_at < now() - interval '30 minutes'
       AND NOT ('welcome' = ANY (COALESCE(th.tags, '{}')))
       AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = th.category_id AND c.slug = ANY (v_review))
       AND (SELECT count(*) FROM public.replies r WHERE r.thread_id = th.id) < 4
     ORDER BY th.created_at
  LOOP
    EXIT WHEN sent >= st.per_hour;
    -- A second helper only joins a post that is at least three hours old.
    CONTINUE WHEN t.helped >= 2 OR (t.helped = 1 AND NOT EXISTS (
      SELECT 1 FROM public.threads x WHERE x.id = t.id AND x.created_at < now() - interval '3 hours'));

    SELECT a.user_id INTO v_helper
      FROM public.helper_reply_accounts a
      JOIN public.profiles p ON p.id = a.user_id AND NOT p.is_banned AND NOT COALESCE(p.is_deleted, false)
     WHERE a.user_id IS DISTINCT FROM t.author
       AND NOT EXISTS (SELECT 1 FROM public.helper_replies h WHERE h.thread_id = t.id AND h.user_id = a.user_id)
       AND NOT EXISTS (SELECT 1 FROM public.replies r WHERE r.thread_id = t.id AND r.user_id = a.user_id)
     ORDER BY random()
     LIMIT 1;
    CONTINUE WHEN v_helper IS NULL;

    SELECT l.id, l.line INTO v_line_id, v_line
      FROM public.helper_reply_lines l
     WHERE NOT EXISTS (SELECT 1 FROM public.helper_replies h WHERE h.thread_id = t.id AND h.line_id = l.id)
     ORDER BY random()
     LIMIT 1;
    CONTINUE WHEN v_line IS NULL;

    SELECT CASE WHEN t.is_anonymous THEN 'friend'
                ELSE COALESCE(NULLIF(split_part(btrim(COALESCE(NULLIF(p.display_name, ''), p.username, '')), ' ', 1), ''), 'friend') END
      INTO v_name
      FROM public.profiles p WHERE p.id = t.author;
    SELECT COALESCE((SELECT s.name FROM public.subgroups s WHERE s.id = t.subgroup_id),
                    (SELECT c.name FROM public.categories c WHERE c.id = t.category_id),
                    'AbiaConnect')
      INTO v_place;

    INSERT INTO public.replies (thread_id, user_id, content)
    VALUES (t.id, v_helper,
            '<p>' || public.html_text(replace(replace(v_line, '{name}', COALESCE(v_name, 'friend')), '{place}', v_place)) || '</p>')
    RETURNING id INTO v_reply;
    INSERT INTO public.helper_replies (thread_id, user_id, reply_id, line_id) VALUES (t.id, v_helper, v_reply, v_line_id);
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_helper_replies() FROM PUBLIC, anon, authenticated;

-- Helper replies don't count as an answer, so champions and admins still get
-- "no reply yet" alerts for posts only helpers have answered.
CREATE OR REPLACE FUNCTION public.unanswered_member_threads(_since interval)
RETURNS TABLE (id uuid, title text, created_at timestamptz, subgroup_id uuid, author_id uuid, is_anonymous boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.title, t.created_at, t.subgroup_id, COALESCE(t.author_id, t.user_id), t.is_anonymous
    FROM public.threads t
   WHERE NOT t.is_deleted AND COALESCE(t.allow_replies, true)
     AND t.created_at > now() - _since
     AND COALESCE(t.author_id, t.user_id) IS DISTINCT FROM public.desk_account()
     AND COALESCE(t.author_id, t.user_id) IS DISTINCT FROM public.newsdesk_author_id()
     AND NOT ('welcome' = ANY (COALESCE(t.tags, '{}')))
     AND NOT EXISTS (
       SELECT 1 FROM public.replies r
        WHERE r.thread_id = t.id
          AND r.user_id IS DISTINCT FROM COALESCE(t.author_id, t.user_id)
          AND r.user_id IS DISTINCT FROM public.desk_account()
          AND NOT EXISTS (SELECT 1 FROM public.helper_replies h WHERE h.reply_id = r.id))
$$;

-- The hourly job ('unanswered-alerts' at :15) runs this; helpers go first so the
-- alert text stays the same. Same body as before plus the helper step.
CREATE OR REPLACE FUNCTION public.alert_unanswered_posts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t record;
  sent integer := 0;
  who text;
  home uuid;
  msg text;
BEGIN
  BEGIN
    PERFORM public.run_helper_replies();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'run_helper_replies: %', SQLERRM;
  END;

  FOR t IN
    SELECT u.* FROM public.unanswered_member_threads(interval '2 days') u
     WHERE u.created_at < now() - interval '2 hours'
       AND NOT EXISTS (SELECT 1 FROM public.unanswered_alerts a WHERE a.thread_id = u.id)
     ORDER BY u.created_at
     LIMIT 20
  LOOP
    INSERT INTO public.unanswered_alerts (thread_id) VALUES (t.id) ON CONFLICT DO NOTHING;
    SELECT CASE WHEN t.is_anonymous THEN 'A member' ELSE COALESCE(NULLIF(p.display_name, ''), 'A member') END, public.lga_group_for(p.lga)
      INTO who, home
      FROM public.profiles p WHERE p.id = t.author_id;
    who := COALESCE(who, 'A member');
    msg := who || '''s post "' || left(t.title, 70) || '" has no reply yet. Be the first to answer 💬';

    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT DISTINCT x.user_id, 'reply_needed', msg, '/thread/' || t.id
      FROM (
        SELECT c.user_id FROM public.group_champions c WHERE c.subgroup_id = COALESCE(t.subgroup_id, home)
        UNION
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('Admin', 'Super Admin')
      ) x
     WHERE x.user_id IS DISTINCT FROM t.author_id;
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END $$;
REVOKE EXECUTE ON FUNCTION public.alert_unanswered_posts() FROM PUBLIC, anon, authenticated;

-- Admin -> Helper replies
CREATE OR REPLACE FUNCTION public.admin_helper_replies()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admins_only';
  END IF;
  RETURN jsonb_build_object(
    'enabled', (SELECT enabled FROM public.helper_reply_settings WHERE id),
    'per_hour', (SELECT per_hour FROM public.helper_reply_settings WHERE id),
    'sent_24h', (SELECT count(*) FROM public.helper_replies WHERE created_at > now() - interval '1 day'),
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', p.id,
               'name', COALESCE(NULLIF(p.display_name, ''), p.username, 'Member'),
               'username', p.username,
               'avatar_url', p.avatar_url) ORDER BY a.added_at)
        FROM public.helper_reply_accounts a JOIN public.profiles p ON p.id = a.user_id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_helper_replies(_enabled boolean, _per_hour integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admins_only';
  END IF;
  UPDATE public.helper_reply_settings
     SET enabled = COALESCE(_enabled, enabled),
         per_hour = LEAST(30, GREATEST(1, COALESCE(_per_hour, per_hour))),
         updated_at = now()
   WHERE id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_helper_reply_account(_user_id uuid, _add boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admins_only';
  END IF;
  IF _add THEN
    INSERT INTO public.helper_reply_accounts (user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.helper_reply_accounts WHERE user_id = _user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_helper_replies() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_helper_replies(boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_helper_reply_account(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_helper_replies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_helper_replies(boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_helper_reply_account(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
