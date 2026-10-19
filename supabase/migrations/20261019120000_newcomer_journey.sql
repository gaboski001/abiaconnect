-- =============================================================================
-- Newcomer journey: make AbiaConnect welcoming and easy for new members.
--
--  1. Interests and a "welcomed" mark on profiles.
--  2. A group for every Local Government Area, a few new interest groups, and
--     sub-topics inside every group (new groups get them automatically).
--  3. complete_welcome(): saves interests, joins the chosen groups, welcomes the
--     member and tells a few active members from the same LGA to say hi.
--  4. get_my_journey() / claim_starter_bonus(): the "first 5 steps" card on
--     Home, with 50 bonus points and the "New Abian" badge at the end.
--  5. A daily, gentle week-1 reminder for members who haven't started yet.
--  6. newcomer_funnel(): numbers for the admin dashboard.
-- =============================================================================

-- ---- 1. Profiles -------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- ---- 2. Groups: kinds, LGA groups, sub-topics --------------------------------
ALTER TABLE public.subgroups
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'interest',
  ADD COLUMN IF NOT EXISTS lga text,
  ADD COLUMN IF NOT EXISTS icon text;

DO $$ BEGIN
  ALTER TABLE public.subgroups ADD CONSTRAINT subgroups_kind_check CHECK (kind IN ('lga', 'interest'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subgroups_one_per_lga ON public.subgroups (lga) WHERE kind = 'lga';

CREATE TABLE IF NOT EXISTS public.subgroup_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id uuid NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  emoji text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subgroup_id, name)
);
CREATE INDEX IF NOT EXISTS subgroup_topics_group ON public.subgroup_topics (subgroup_id, display_order);

-- Everyone may read topics; changes are allowed by the policy below (admins and group creators only).
REVOKE ALL ON public.subgroup_topics FROM anon, authenticated;
GRANT SELECT ON public.subgroup_topics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subgroup_topics TO authenticated;
GRANT ALL ON public.subgroup_topics TO service_role;

ALTER TABLE public.subgroup_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Topics are visible to everyone" ON public.subgroup_topics;
CREATE POLICY "Topics are visible to everyone" ON public.subgroup_topics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and group creators manage topics" ON public.subgroup_topics;
CREATE POLICY "Admins and group creators manage topics" ON public.subgroup_topics
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.subgroups s WHERE s.id = subgroup_id AND s.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.subgroups s WHERE s.id = subgroup_id AND s.created_by = auth.uid())
  );

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.subgroup_topics(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS threads_topic ON public.threads (topic_id) WHERE topic_id IS NOT NULL;

-- A discussion's topic must belong to the group it is posted in.
CREATE OR REPLACE FUNCTION public.threads_check_topic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.topic_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subgroup_topics t
     WHERE t.id = NEW.topic_id AND t.subgroup_id IS NOT DISTINCT FROM NEW.subgroup_id
  ) THEN
    NEW.topic_id := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.threads_check_topic() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS threads_check_topic ON public.threads;
CREATE TRIGGER threads_check_topic BEFORE INSERT OR UPDATE OF topic_id, subgroup_id ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.threads_check_topic();

-- The starting sub-topics for a group.
CREATE OR REPLACE FUNCTION public.add_default_topics(_group uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g public.subgroups%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.subgroups WHERE id = _group;
  IF NOT FOUND THEN RETURN; END IF;
  IF g.kind = 'lga' THEN
    INSERT INTO public.subgroup_topics (subgroup_id, name, emoji, description, display_order) VALUES
      (_group, 'Introduce yourself', '👋', 'New here? Say hello: your town or village, where you live now and what you do.', 1),
      (_group, 'News & happenings', '📰', 'What is going on at home: news, notices and updates.', 2),
      (_group, 'Development & projects', '🏗️', 'Roads, schools, water, power and community projects.', 3),
      (_group, 'Business & jobs', '💼', 'Shops, services, jobs and opportunities in and from the LGA.', 4),
      (_group, 'Events & ceremonies', '🎉', 'Weddings, burials, festivals, meetings and get-togethers.', 5),
      (_group, 'Ask a question', '🙋', 'Need directions, a contact or advice? Ask your people.', 6)
    ON CONFLICT (subgroup_id, name) DO NOTHING;
  ELSE
    INSERT INTO public.subgroup_topics (subgroup_id, name, emoji, description, display_order) VALUES
      (_group, 'Introduce yourself', '👋', 'Say hello and tell the group what brings you here.', 1),
      (_group, 'General chat', '💬', 'Anything on the group''s subject.', 2),
      (_group, 'Questions & help', '🙋', 'Ask the group for advice or help.', 3),
      (_group, 'Opportunities', '🚀', 'Jobs, deals, collaborations and openings.', 4),
      (_group, 'Events & meetups', '📅', 'Meetings, events and get-togethers.', 5)
    ON CONFLICT (subgroup_id, name) DO NOTHING;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.add_default_topics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_default_topics(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.subgroups_add_topics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.add_default_topics(NEW.id);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.subgroups_add_topics() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS subgroups_add_topics ON public.subgroups;
CREATE TRIGGER subgroups_add_topics AFTER INSERT ON public.subgroups
  FOR EACH ROW EXECUTE FUNCTION public.subgroups_add_topics();

-- One group for each of Abia's 17 LGAs.
INSERT INTO public.subgroups (name, description, category, kind, lga, icon, is_private, is_active, rules)
SELECT
  x.lga_name || ' LGA',
  'The home of ' || x.lga_name || ' people on AbiaConnect, at home and abroad. Share news from home, follow development projects, find business and jobs, announce events and meet your people.',
  'Local Government Areas', 'lga', x.lga_name, '📍', false, true,
  ARRAY['Be respectful: we are all family here.', 'Keep posts about ' || x.lga_name || ' and its people.', 'No scams, spam or hate speech.']
FROM unnest(ARRAY[
  'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano',
  'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia',
  'Osisioma Ngwa', 'Ugwunagbo', 'Ukwa East', 'Ukwa West',
  'Umuahia North', 'Umuahia South', 'Umunneochi'
]) AS x(lga_name)
WHERE NOT EXISTS (SELECT 1 FROM public.subgroups s WHERE s.kind = 'lga' AND s.lga = x.lga_name);

-- A few new interest groups people often look for.
INSERT INTO public.subgroups (name, description, category, kind, icon, is_private, is_active, rules)
SELECT name, description, category, 'interest', icon, false, true,
       ARRAY['Be respectful.', 'Stay on the group''s subject.', 'No scams or spam.']
FROM (VALUES
  ('Jobs & Opportunities in Abia', 'Job openings, internships, contracts and business opportunities for Abians.', 'Career', '💼'),
  ('Abia Events & Meetups', 'Festivals, meetups, conferences and community events, at home and abroad.', 'Culture', '🎉'),
  ('Igbo Language & Proverbs', 'Learn and enjoy Igbo: words, proverbs, stories and songs.', 'Culture', '🗣️'),
  ('Abia Students & Youth', 'For students and young Abians: school, skills, scholarships and fun.', 'Education', '🎓'),
  ('Abia Food & Recipes', 'Ofe Owerri, Abacha, Nkwobi and more: recipes, restaurants and food business.', 'Lifestyle', '🍲')
) AS g(name, description, category, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.subgroups s WHERE lower(s.name) = lower(g.name));

-- Sub-topics for every group that doesn't have any yet (new groups got theirs from the trigger).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.subgroups s
            WHERE NOT EXISTS (SELECT 1 FROM public.subgroup_topics t WHERE t.subgroup_id = s.id) LOOP
    PERFORM public.add_default_topics(r.id);
  END LOOP;
END $$;

-- ---- 3. The welcome ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lga_group_for(_lga text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT id FROM public.subgroups WHERE kind = 'lga' AND lga = _lga AND is_active LIMIT 1 $$;
REVOKE EXECUTE ON FUNCTION public.lga_group_for(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lga_group_for(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_welcome(_interests text[], _groups uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  me public.profiles%ROWTYPE;
  first_time boolean;
  lga_group uuid;
  intro uuid;
  joined integer := 0;
  greeted integer := 0;
  g uuid;
  neighbour record;
  greet_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT * INTO me FROM public.profiles WHERE id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found.'; END IF;

  first_time := me.onboarded_at IS NULL;
  UPDATE public.profiles
     SET interests = COALESCE((SELECT array_agg(DISTINCT i) FROM unnest(_interests) AS i WHERE length(i) BETWEEN 1 AND 40), '{}'),
         onboarded_at = COALESCE(onboarded_at, now())
   WHERE id = uid;

  -- Join the chosen public groups (private ones need a request, as before).
  FOREACH g IN ARRAY COALESCE(_groups[1:12], '{}') LOOP
    IF EXISTS (SELECT 1 FROM public.subgroups s WHERE s.id = g AND s.is_active AND NOT s.is_private) THEN
      INSERT INTO public.subgroup_members (subgroup_id, user_id) VALUES (g, uid)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN joined := joined + 1; END IF;
    END IF;
  END LOOP;

  IF first_time THEN
    greet_name := COALESCE(NULLIF(split_part(me.display_name, ' ', 1), ''), me.username, 'there');
    lga_group := public.lga_group_for(me.lga);

    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (uid, 'welcome',
      'Welcome to AbiaConnect, ' || greet_name || '! Your first 5 steps are on your home page. Finish them for 50 bonus points and the New Abian badge.',
      '/');

    -- A few active members from the same LGA are asked to say hi.
    IF lga_group IS NOT NULL THEN
      SELECT id INTO intro FROM public.subgroup_topics
       WHERE subgroup_id = lga_group AND subgroup_topics.name = 'Introduce yourself' LIMIT 1;
      FOR neighbour IN
        SELECT p.id FROM public.profiles p
          JOIN public.member_stats m ON m.user_id = p.id
         WHERE p.lga = me.lga AND p.id <> uid
           AND NOT COALESCE(p.is_banned, false) AND NOT COALESCE(p.is_deleted, false)
           AND m.updated_at > now() - interval '30 days'
         ORDER BY m.points DESC
         LIMIT 5
      LOOP
        INSERT INTO public.notifications (user_id, type, message, link)
        VALUES (neighbour.id, 'welcome_neighbour',
          COALESCE(NULLIF(me.display_name, ''), me.username, 'A new member') || ' from ' || me.lga || ' just joined AbiaConnect. Say hi and make them feel at home!',
          '/subgroups/' || lga_group || CASE WHEN intro IS NOT NULL THEN '?topic=' || intro ELSE '' END);
        greeted := greeted + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('joined', joined, 'greeted', greeted, 'lga_group', lga_group);
END $$;
REVOKE EXECUTE ON FUNCTION public.complete_welcome(text[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_welcome(text[], uuid[]) TO authenticated, service_role;

-- ---- 4. The first 5 steps --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_journey()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  me public.profiles%ROWTYPE;
  lga_group uuid;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO me FROM public.profiles WHERE id = uid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  lga_group := public.lga_group_for(me.lga);
  RETURN jsonb_build_object(
    'created_at', me.created_at,
    'onboarded_at', me.onboarded_at,
    'lga', me.lga,
    'interests', me.interests,
    'lga_group', lga_group,
    'bonus_claimed', EXISTS (SELECT 1 FROM public.points_ledger WHERE user_id = uid AND reason = 'starter_bonus'),
    'steps', jsonb_build_object(
      'interests', COALESCE(array_length(me.interests, 1), 0) > 0,
      'group', EXISTS (
        SELECT 1 FROM public.subgroup_members sm
          JOIN public.subgroups s ON s.id = sm.subgroup_id
         WHERE sm.user_id = uid AND (s.kind = 'lga' OR s.id = lga_group)
      ) OR (lga_group IS NULL AND EXISTS (SELECT 1 FROM public.subgroup_members WHERE user_id = uid)),
      'vote', EXISTS (SELECT 1 FROM public.poll_votes WHERE user_id = uid),
      'hello', EXISTS (SELECT 1 FROM public.threads WHERE COALESCE(author_id, user_id) = uid AND NOT is_deleted)
            OR EXISTS (SELECT 1 FROM public.replies WHERE user_id = uid),
      'photo', COALESCE(me.avatar_url, '') <> ''
    )
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.get_my_journey() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_journey() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_starter_bonus()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  journey jsonb := public.get_my_journey();
  steps jsonb := journey -> 'steps';
  applied integer;
BEGIN
  IF uid IS NULL OR journey IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  IF NOT ((steps ->> 'interests')::boolean AND (steps ->> 'group')::boolean AND (steps ->> 'vote')::boolean
          AND (steps ->> 'hello')::boolean AND (steps ->> 'photo')::boolean) THEN
    RAISE EXCEPTION 'Finish all 5 steps first.';
  END IF;
  applied := public.award_points(uid, 50, 'starter_bonus', 'starter');
  INSERT INTO public.member_badges (user_id, badge) VALUES (uid, 'new_abian') ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (uid, 'reward', 'You earned the New Abian badge and 50 bonus points. Welcome to the family!', '/rewards');
  END IF;
  RETURN applied;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_starter_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_starter_bonus() TO authenticated, service_role;

-- ---- 5. Gentle week-1 reminders -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newcomer_nudges (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stage)
);
-- No policies and no member access: only the server's own functions read or write it.
REVOKE ALL ON public.newcomer_nudges FROM anon, authenticated;
GRANT ALL ON public.newcomer_nudges TO service_role;

ALTER TABLE public.newcomer_nudges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.send_newcomer_nudges()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  sent integer := 0;
  lga_group uuid;
  fresh integer;
BEGIN
  FOR r IN
    SELECT p.id, p.lga, p.created_at,
           CASE
             WHEN p.created_at < now() - interval '6 days' THEN 3
             WHEN p.created_at < now() - interval '3 days' THEN 2
             ELSE 1
           END AS stage
      FROM public.profiles p
     WHERE p.created_at BETWEEN now() - interval '8 days' AND now() - interval '20 hours'
       AND NOT COALESCE(p.is_banned, false) AND NOT COALESCE(p.is_deleted, false)
       AND NOT EXISTS (SELECT 1 FROM public.points_ledger l WHERE l.user_id = p.id AND l.reason = 'starter_bonus')
  LOOP
    -- Only one reminder per stage, and never two on the same day.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.newcomer_nudges n WHERE n.user_id = r.id AND (n.stage >= r.stage OR n.sent_at > now() - interval '20 hours'));
    lga_group := public.lga_group_for(r.lga);

    IF r.stage = 1 THEN
      INSERT INTO public.notifications (user_id, type, message, link) VALUES (r.id, 'nudge',
        'Say hello to your people! Your first discussion earns 15 points, and it only takes a minute.',
        COALESCE('/subgroups/' || lga_group, '/subgroups'));
    ELSIF r.stage = 2 THEN
      SELECT count(*) INTO fresh FROM public.threads t
       WHERE t.subgroup_id = lga_group AND t.created_at > now() - interval '7 days' AND NOT t.is_deleted;
      INSERT INTO public.notifications (user_id, type, message, link) VALUES (r.id, 'nudge',
        CASE WHEN fresh > 0
          THEN fresh || ' new discussion' || CASE WHEN fresh = 1 THEN '' ELSE 's' END || ' in your LGA group this week. See what your people are talking about.'
          ELSE 'See what Abians are talking about today, and vote in a poll for 2 quick points.' END,
        CASE WHEN fresh > 0 THEN '/subgroups/' || lga_group ELSE '/polls' END);
    ELSE
      INSERT INTO public.notifications (user_id, type, message, link) VALUES (r.id, 'nudge',
        'You''re close to your New Abian badge and 50 bonus points. Your remaining steps are on your home page.',
        '/');
    END IF;

    INSERT INTO public.newcomer_nudges (user_id, stage) VALUES (r.id, r.stage) ON CONFLICT DO NOTHING;
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_newcomer_nudges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_newcomer_nudges() TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('newcomer-nudges');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('newcomer-nudges', '0 9 * * *', $$SELECT public.send_newcomer_nudges()$$); -- 10:00 Lagos

-- ---- 6. Numbers for the admin dashboard ------------------------------------------------
CREATE OR REPLACE FUNCTION public.newcomer_funnel(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => GREATEST(1, LEAST(_days, 365)));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only.'; END IF;
  RETURN (
    WITH joined AS (
      SELECT id, created_at, onboarded_at FROM public.profiles
       WHERE created_at >= since AND NOT COALESCE(is_deleted, false)
    )
    SELECT jsonb_build_object(
      'joined', count(*),
      'welcomed', count(*) FILTER (WHERE onboarded_at IS NOT NULL),
      'acted_first_day', count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.points_ledger l
         WHERE l.user_id = j.id AND l.reason IN ('thread', 'reply', 'poll_vote', 'contest_vote')
           AND l.created_at < j.created_at + interval '24 hours')),
      'finished_steps', count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.points_ledger l WHERE l.user_id = j.id AND l.reason = 'starter_bonus')),
      'came_back_week_2', count(*) FILTER (WHERE j.created_at < now() - interval '7 days' AND EXISTS (
        SELECT 1 FROM public.points_ledger l
         WHERE l.user_id = j.id AND l.created_at >= j.created_at + interval '7 days')),
      'old_enough_for_week_2', count(*) FILTER (WHERE j.created_at < now() - interval '7 days')
    )
    FROM joined j
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.newcomer_funnel(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.newcomer_funnel(integer) TO authenticated, service_role;
