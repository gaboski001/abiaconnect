-- Members first. The Newsdesk wrote 9 of every 10 posts, which buried what
-- members said, so:
--   1. The Newsdesk makes a few posts a day in total (3 to start), taking the
--      forums in turn, instead of up to 3 in each forum.
--   2. The home page can tell Newsdesk posts apart, to show members' posts first.
--   3. LGA champions: members an admin picks to greet newcomers and answer posts.
--      They hear about every introduction in their group, and about any member
--      post nobody has answered after 2 hours (admins hear about those too).
--   4. "Waiting for a reply": the posts nobody has answered, for champions and admins.
-- Safe to run more than once.

-- ---- 1. A few Newsdesk posts a day, the forums in turn -------------------------------
-- The bot itself reads forum_limits (posts per forum today). That is now worked
-- out every morning from two admin settings: daily_total (posts a day in all) and
-- forum_choices (the forums the bot may post in).
ALTER TABLE public.newsdesk_settings
  ADD COLUMN IF NOT EXISTS daily_total integer NOT NULL DEFAULT 3 CHECK (daily_total BETWEEN 0 AND 15),
  ADD COLUMN IF NOT EXISTS forum_choices jsonb;

UPDATE public.newsdesk_settings s
   SET forum_choices = (
     SELECT COALESCE(jsonb_object_agg(c.slug,
              CASE WHEN COALESCE((s.forum_limits ->> c.slug)::int, s.default_forum_limit) > 0 THEN 1 ELSE 0 END), '{}'::jsonb)
       FROM public.categories c WHERE c.slug IS NOT NULL)
 WHERE s.forum_choices IS NULL;

CREATE OR REPLACE FUNCTION public.newsdesk_plan_today()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.newsdesk_settings%ROWTYPE;
  today date := public.community_today();
  plan jsonb;
  done_today integer;
  room integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only.'; END IF;
  SELECT * INTO s FROM public.newsdesk_settings WHERE id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Forums the bot has already posted in today keep what they have.
  SELECT COALESCE(jsonb_object_agg(x.category_slug, x.n), '{}'::jsonb), COALESCE(sum(x.n), 0)
    INTO plan, done_today
    FROM (SELECT category_slug, count(*)::int AS n FROM public.newsdesk_posts
           WHERE run_date = today AND status <> 'rejected' GROUP BY 1) x;
  room := GREATEST(0, s.daily_total - done_today);

  -- The rest of today's posts go to the chosen forums it has waited longest to post in.
  plan := plan || COALESCE((
    SELECT jsonb_object_agg(y.slug, 1) FROM (
      SELECT c.slug FROM public.categories c
       WHERE c.is_active AND c.slug IS NOT NULL
         AND COALESCE((s.forum_choices ->> c.slug)::int, 0) > 0
         AND NOT (plan ? c.slug)
       ORDER BY (SELECT max(p.run_date) FROM public.newsdesk_posts p
                  WHERE p.category_slug = c.slug AND p.status <> 'rejected') NULLS FIRST, random()
       LIMIT room) y), '{}'::jsonb);

  -- Every other forum: nothing today.
  plan := COALESCE((SELECT jsonb_object_agg(c.slug, 0) FROM public.categories c WHERE c.slug IS NOT NULL), '{}'::jsonb) || plan;
  UPDATE public.newsdesk_settings SET forum_limits = plan, default_forum_limit = 0, updated_at = now() WHERE id;
  RETURN plan;
END $$;
REVOKE EXECUTE ON FUNCTION public.newsdesk_plan_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.newsdesk_plan_today() TO authenticated, service_role;

-- 06:00 Lagos, before the bot's first run at 07:30.
DO $$ BEGIN PERFORM cron.unschedule('newsdesk-plan'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('newsdesk-plan', '0 5 * * *', $$SELECT public.newsdesk_plan_today()$$);
SELECT public.newsdesk_plan_today();

-- ---- 2. Which account is the Newsdesk (its posts are shown apart from members') ------
CREATE OR REPLACE FUNCTION public.newsdesk_author_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT author_id FROM public.newsdesk_settings WHERE id $$;
REVOKE EXECUTE ON FUNCTION public.newsdesk_author_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsdesk_author_id() TO anon, authenticated, service_role;

-- ---- 3. LGA champions ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_champions (
  subgroup_id uuid NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subgroup_id, user_id)
);
ALTER TABLE public.group_champions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.group_champions TO anon, authenticated;
GRANT ALL ON public.group_champions TO service_role;
-- Who the champions are is public, so members know who to turn to.
DROP POLICY IF EXISTS "Champions are public" ON public.group_champions;
CREATE POLICY "Champions are public" ON public.group_champions FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.admin_set_group_champion(_subgroup uuid, _user uuid, _on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g public.subgroups%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only.'; END IF;
  SELECT * INTO g FROM public.subgroups WHERE id = _subgroup;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found.'; END IF;
  IF NOT _on THEN
    DELETE FROM public.group_champions WHERE subgroup_id = _subgroup AND user_id = _user;
    RETURN;
  END IF;
  INSERT INTO public.group_champions (subgroup_id, user_id, added_by) VALUES (_subgroup, _user, auth.uid())
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  -- A champion belongs to the group they look after.
  INSERT INTO public.subgroup_members (subgroup_id, user_id) VALUES (_subgroup, _user) ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (_user, 'champion',
    'You''re now a community champion for ' || g.name || ' 🏅 You''ll get an alert whenever someone new says hello or a post there is waiting for a reply. Thank you!',
    '/subgroups/' || _subgroup);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_group_champion(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_group_champion(uuid, uuid, boolean) TO authenticated, service_role;

-- The Desk's welcome: the group's champions always hear about it, and up to 5
-- other active members (each at most twice a day).
CREATE OR REPLACE FUNCTION public.desk_welcome(_subgroup uuid, _member uuid, _thread uuid, _parent_reply uuid, _intro text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  desk uuid := public.desk_account();
  g public.subgroups%ROWTYPE;
  display text;
  first_name text;
  place_name text;
  place text;
  link text;
  opening text;
  reply uuid;
  ask text;
BEGIN
  -- Admins replying to newcomers are hosts, not newcomers.
  IF desk IS NULL OR _member IS NULL OR _member = desk OR public.is_admin(_member) THEN RETURN NULL; END IF;
  SELECT * INTO g FROM public.subgroups WHERE id = _subgroup;
  IF NOT FOUND OR g.is_private OR NOT g.is_active THEN RETURN NULL; END IF;

  INSERT INTO public.group_desk_welcomes (subgroup_id, user_id) VALUES (_subgroup, _member)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT p.display_name INTO display FROM public.profiles p WHERE p.id = _member;
  first_name := public.html_text(public.intro_first_name(_intro, display));
  place_name := CASE WHEN g.kind = 'lga' AND g.lga IS NOT NULL THEN g.lga || ' LGA' ELSE g.name END;
  place := public.html_text(place_name);
  link := 'https://abiaconnect.com/subgroups/' || g.id;
  opening := (ARRAY[
    'Nnọọ, <strong>' || first_name || '</strong>! 🎉 Welcome to the <strong>' || place || '</strong> family. We are so glad you are here. 🤗',
    'Ndewo, <strong>' || first_name || '</strong>! 👋🏾 A very warm welcome to <strong>' || place || '</strong>. It is lovely to meet you!',
    'Nnọọ nụ, <strong>' || first_name || '</strong>! 💚 Thank you for introducing yourself. <strong>' || place || '</strong> just got better with you in it.'
  ])[1 + floor(random() * 3)::int];

  INSERT INTO public.replies (thread_id, user_id, parent_reply_id, content)
  VALUES (_thread, desk, _parent_reply,
    '<p>' || opening || '</p>' ||
    '<p>Feel at home: share what you do, ask questions and join the conversations. Your people are here for you.</p>' ||
    '<p>🤝🏾 <strong>Help us grow the family.</strong> Share this group with your loved ones, your WhatsApp groups, your age grade, church or association:<br>👉🏾 <a href="' || link || '" target="_blank" rel="noopener noreferrer">' || link || '</a></p>' ||
    '<p>And invite your friends and family to AbiaConnect too: 👉🏾 <a href="https://abiaconnect.com" target="_blank" rel="noopener noreferrer">abiaconnect.com</a> 💚</p>' ||
    '<p><strong>Igwe bụ ike</strong>: together we are strong!<br><em>The AbiaConnect Desk</em></p>')
  RETURNING id INTO reply;

  UPDATE public.group_desk_welcomes SET reply_id = reply WHERE subgroup_id = _subgroup AND user_id = _member;

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (_member, 'reply', 'The AbiaConnect Desk welcomed you to ' || place_name || ' 🎉', '/thread/' || _thread);

  ask := public.intro_first_name(_intro, display) || ' just introduced themselves in ' || place_name || '. Say hi and make them feel at home! 👋🏾';
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT c.user_id, 'welcome_neighbour', ask, '/thread/' || _thread
    FROM public.group_champions c
   WHERE c.subgroup_id = _subgroup AND c.user_id <> _member AND c.user_id <> desk;

  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT sm.user_id, 'welcome_neighbour', ask, '/thread/' || _thread
    FROM public.subgroup_members sm
    JOIN public.profiles p ON p.id = sm.user_id
   WHERE sm.subgroup_id = _subgroup AND sm.user_id <> _member AND sm.user_id <> desk
     AND NOT EXISTS (SELECT 1 FROM public.group_champions c WHERE c.subgroup_id = _subgroup AND c.user_id = sm.user_id)
     AND NOT COALESCE(p.is_banned, false) AND NOT COALESCE(p.is_deleted, false)
     AND EXISTS (SELECT 1 FROM public.points_ledger l WHERE l.user_id = sm.user_id AND l.created_at > now() - interval '14 days')
     AND NOT EXISTS (SELECT 1 FROM public.notifications n
                      WHERE n.user_id = sm.user_id AND n.type = 'welcome_neighbour' AND n.created_at > now() - interval '12 hours')
   ORDER BY random()
   LIMIT 5;
  RETURN reply;
END $$;
REVOKE EXECUTE ON FUNCTION public.desk_welcome(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desk_welcome(uuid, uuid, uuid, uuid, text) TO service_role;

-- ---- 4. Posts waiting for a reply ----------------------------------------------------
-- A member's post (not the Desk's or the Newsdesk's) from the last week that
-- nobody else has answered yet.
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
          AND r.user_id IS DISTINCT FROM public.desk_account())
$$;
REVOKE EXECUTE ON FUNCTION public.unanswered_member_threads(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unanswered_member_threads(interval) TO service_role;

-- What a champion or admin sees: admins every waiting post, champions the ones in their groups.
CREATE OR REPLACE FUNCTION public.posts_waiting_for_reply(_limit integer DEFAULT 10)
RETURNS TABLE (id uuid, title text, created_at timestamptz, group_name text, author_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin boolean := public.is_admin(auth.uid());
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF NOT admin AND NOT EXISTS (SELECT 1 FROM public.group_champions WHERE user_id = uid) THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id, u.title, u.created_at, s.name,
           CASE WHEN u.is_anonymous THEN 'A member' ELSE COALESCE(NULLIF(p.display_name, ''), 'A member') END
      FROM public.unanswered_member_threads(interval '7 days') u
      LEFT JOIN public.subgroups s ON s.id = u.subgroup_id
      LEFT JOIN public.profiles p ON p.id = u.author_id
     WHERE u.author_id IS DISTINCT FROM uid
       AND (admin OR u.subgroup_id IN (SELECT c.subgroup_id FROM public.group_champions c WHERE c.user_id = uid))
     ORDER BY u.created_at
     LIMIT GREATEST(1, LEAST(_limit, 50));
END $$;
REVOKE EXECUTE ON FUNCTION public.posts_waiting_for_reply(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.posts_waiting_for_reply(integer) TO authenticated, service_role;

-- Every hour: a member post still unanswered after 2 hours alerts the group's
-- champions (or, for a forum post, the champions of the author's LGA) and the admins. Once per post.
CREATE TABLE IF NOT EXISTS public.unanswered_alerts (
  thread_id uuid PRIMARY KEY REFERENCES public.threads(id) ON DELETE CASCADE,
  alerted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unanswered_alerts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.unanswered_alerts TO service_role;

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
GRANT EXECUTE ON FUNCTION public.alert_unanswered_posts() TO service_role;

-- Posts from before today don't need an alert now: they're in the "Waiting for a reply" list.
INSERT INTO public.unanswered_alerts (thread_id)
SELECT t.id FROM public.threads t WHERE t.created_at < now() - interval '2 hours'
ON CONFLICT DO NOTHING;

DO $$ BEGIN PERFORM cron.unschedule('unanswered-alerts'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('unanswered-alerts', '15 * * * *', $$SELECT public.alert_unanswered_posts()$$);

NOTIFY pgrst, 'reload schema';
