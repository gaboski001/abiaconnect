-- New members introduce themselves by replying on their group's pinned welcome
-- thread, not by starting a second "Introduction" thread next to it. And a daily
-- rhythm that keeps members, newcomers most of all, coming back:
--   1. Introductions already posted as their own thread move onto the welcome thread.
--   2. When someone introduces themselves, a few active members of the group are asked to say hi.
--   3. A "Question of the day" every morning, posted by the Desk.
--   4. One friendly reminder a day at most, in the evening, to members who haven't been in today.
-- Safe to run more than once.

-- ---- 1. Move introductions that were posted as their own thread --------------------
-- Only threads nobody but the Desk has answered, so no conversation is broken up.
DO $$
DECLARE
  desk uuid := public.desk_account();
  t record;
  welcome uuid;
  moved uuid;
BEGIN
  FOR t IN
    SELECT th.id, th.subgroup_id, COALESCE(th.author_id, th.user_id) AS author, th.content, th.created_at
      FROM public.threads th
      LEFT JOIN public.subgroup_topics st ON st.id = th.topic_id
     WHERE th.subgroup_id IS NOT NULL AND NOT th.is_deleted AND NOT th.is_anonymous
       AND NOT ('welcome' = ANY (COALESCE(th.tags, '{}')))
       AND (st.name = 'Introduce yourself' OR public.looks_like_intro(th.title || ' ' || COALESCE(th.content, '')))
       AND NOT public.is_admin(COALESCE(th.author_id, th.user_id))
       AND NOT EXISTS (SELECT 1 FROM public.replies r WHERE r.thread_id = th.id AND r.user_id IS DISTINCT FROM desk)
     ORDER BY th.created_at
  LOOP
    SELECT w.id INTO welcome FROM public.threads w
     WHERE w.subgroup_id = t.subgroup_id AND 'welcome' = ANY (COALESCE(w.tags, '{}')) AND NOT w.is_deleted
     ORDER BY w.created_at LIMIT 1;
    CONTINUE WHEN welcome IS NULL OR t.author IS NULL;

    INSERT INTO public.replies (thread_id, user_id, content, created_at)
    VALUES (welcome, t.author, COALESCE(NULLIF(t.content, ''), '<p>Hello everyone!</p>'), t.created_at)
    RETURNING id INTO moved;
    -- The Desk's welcome follows the introduction as an answer to it.
    UPDATE public.replies SET thread_id = welcome, parent_reply_id = moved
     WHERE thread_id = t.id AND user_id = desk;
    -- Moving isn't removing: the member keeps the points the post earned.
    UPDATE public.points_ledger SET ref_id = 'moved:' || ref_id
     WHERE user_id = t.author AND reason = 'thread' AND ref_id = t.id::text;
    UPDATE public.threads SET is_deleted = true WHERE id = t.id;
  END LOOP;
END $$;

-- ---- 2. The Desk's welcome also asks a few neighbours to say hi ---------------------
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

  -- A newcomer who hears from real people comes back. Up to 5 members of the
  -- group who were active in the last 2 weeks, each asked at most twice a day.
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT sm.user_id, 'welcome_neighbour',
         public.intro_first_name(_intro, display) || ' just introduced themselves in ' || place_name || '. Say hi and make them feel at home! 👋🏾',
         '/thread/' || _thread
    FROM public.subgroup_members sm
    JOIN public.profiles p ON p.id = sm.user_id
   WHERE sm.subgroup_id = _subgroup AND sm.user_id <> _member AND sm.user_id <> desk
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

-- A group's welcome thread (the oldest one), for links.
CREATE OR REPLACE FUNCTION public.group_welcome_thread(_subgroup uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.threads
   WHERE subgroup_id = _subgroup AND 'welcome' = ANY (COALESCE(tags, '{}')) AND NOT is_deleted
   ORDER BY created_at LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.group_welcome_thread(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.group_welcome_thread(uuid) TO service_role;

-- ---- 3. Question of the day ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_questions (
  id serial PRIMARY KEY,
  question text NOT NULL UNIQUE,
  last_used date,
  thread_id uuid
);
GRANT ALL ON public.daily_questions TO service_role;
GRANT USAGE ON SEQUENCE public.daily_questions_id_seq TO service_role;
ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.daily_questions (question) VALUES
  ('Which Abia soup is the king of soups: ofe owerri, oha, egusi, or nsala? 🍲'),
  ('What is one thing you miss most about home when you are away? 🏡'),
  ('Aba made or imported: what is the best thing you have bought that was made in Aba? 👞'),
  ('Which town or village are you from, and what is it famous for? 📍'),
  ('What is the best advice an elder in your family ever gave you? 👴🏾'),
  ('If you could fix one road in Abia State today, which would it be? 🛣️'),
  ('What small business would you start in your LGA with ₦500,000? 💼'),
  ('Which Igbo proverb do you use the most, and what does it mean? 🗣️'),
  ('What is your favourite memory of the New Yam Festival? 🍠'),
  ('Umuahia, Aba or Ohafia: where is the best place to spend a weekend in Abia? 🌴'),
  ('What skill should every young Abian learn this year? 🛠️'),
  ('Who is an Abian you are proud of, and why? 🌟'),
  ('Abacha with ugba or abacha without: settle it! 😄'),
  ('What is one thing your LGA does better than any other? 🏆'),
  ('Which Igbo name do you love the most, and what does it mean? 💚'),
  ('What would make you move back home to Abia, if you live away? ✈️'),
  ('What was your first job, and what did it teach you? 🧑🏾‍💼'),
  ('Which market do you trust the most for good prices: Ariaria, Ahia Ohuru, or another? 🛒'),
  ('What is a song that always reminds you of home? 🎶'),
  ('What should the Abia government focus on next: roads, power, jobs or schools? 🏛️'),
  ('Share one tip that has helped you save money this month. 💰'),
  ('Which game did you love most as a child: okwe, nchọkọtọ, ọga, or another? ⚽'),
  ('What is the best thing about being Igbo? 🦅'),
  ('Night or morning: when do you get your best work done? ⏰'),
  ('If you could ask the governor one question, what would it be? 🎤'),
  ('What is one way we can help young people in our communities find work? 🤝🏾'),
  ('Which dish do you cook best? Share your secret! 👩🏾‍🍳'),
  ('What tradition from your village should never die? 🥁'),
  ('Tell us one good thing that happened to you this week. 😊'),
  ('Which Abian business deserves more customers? Give them a shout-out! 📣')
ON CONFLICT (question) DO NOTHING;

CREATE OR REPLACE FUNCTION public.post_question_of_the_day()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := public.community_today();
  desk uuid := public.desk_account();
  q public.daily_questions%ROWTYPE;
  cat uuid;
  thread uuid;
BEGIN
  IF desk IS NULL OR EXISTS (SELECT 1 FROM public.daily_questions WHERE last_used = today) THEN RETURN NULL; END IF;
  SELECT id INTO cat FROM public.categories WHERE slug = 'general-discussion';
  IF cat IS NULL THEN SELECT id INTO cat FROM public.categories ORDER BY name LIMIT 1; END IF;
  -- The questions asked longest ago (or never) come round first.
  SELECT * INTO q FROM public.daily_questions ORDER BY last_used NULLS FIRST, random() LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.threads (category_id, user_id, author_id, title, content, tags, allow_replies, is_anonymous)
  VALUES (cat, desk, desk,
    'Question of the day: ' || q.question,
    '<p><strong>' || public.html_text(q.question) || '</strong></p>' ||
    '<p>Tell us in the replies. There are no wrong answers, and every reply earns you points. 💬</p>' ||
    '<p>Share this with a friend and hear what they think too! 👉🏾 <a href="https://abiaconnect.com" target="_blank" rel="noopener noreferrer">abiaconnect.com</a></p>' ||
    '<p><em>The AbiaConnect Desk</em></p>',
    ARRAY['question-of-the-day', 'community'], true, false)
  RETURNING id INTO thread;

  UPDATE public.daily_questions SET last_used = today, thread_id = thread WHERE id = q.id;
  RETURN thread;
END $$;
REVOKE EXECUTE ON FUNCTION public.post_question_of_the_day() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_question_of_the_day() TO service_role;

-- ---- 4. One friendly reminder a day ---------------------------------------------------
-- For members who haven't been in today, at most one reminder a day (counting the
-- newcomer reminders): new members every day for 2 weeks, members with a streak
-- about to break, and others every 3 days while they've been away 2 to 30 days.
CREATE OR REPLACE FUNCTION public.send_daily_nudges()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := public.community_today();
  r record;
  sent integer := 0;
  grp uuid;
  welcome uuid;
  joined_today integer;
  q public.daily_questions%ROWTYPE;
  msg text;
  dest text;
BEGIN
  SELECT * INTO q FROM public.daily_questions WHERE last_used = today AND thread_id IS NOT NULL LIMIT 1;

  FOR r IN
    SELECT p.id, p.lga, p.created_at, COALESCE(ms.current_streak, 0) AS streak, ms.last_checkin,
           p.created_at > now() - interval '14 days' AS newcomer
      FROM public.profiles p
      LEFT JOIN public.member_stats ms ON ms.user_id = p.id
     WHERE NOT COALESCE(p.is_banned, false) AND NOT COALESCE(p.is_deleted, false)
       AND p.created_at < now() - interval '20 hours'
       AND NOT public.is_admin(p.id) AND p.id IS DISTINCT FROM public.desk_account()
       AND NOT EXISTS (SELECT 1 FROM public.points_ledger l WHERE l.user_id = p.id AND l.day = today)
       AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = p.id AND n.type = 'nudge' AND n.created_at > now() - interval '20 hours')
       AND (
         p.created_at > now() - interval '14 days'
         OR (COALESCE(ms.current_streak, 0) >= 2 AND ms.last_checkin = today - 1)
         OR (COALESCE(ms.last_checkin, p.created_at::date) BETWEEN today - 30 AND today - 2
             AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = p.id AND n.type = 'nudge' AND n.created_at > now() - interval '3 days'))
       )
  LOOP
    grp := public.lga_group_for(r.lga);
    welcome := CASE WHEN grp IS NULL THEN NULL ELSE public.group_welcome_thread(grp) END;
    SELECT count(*) INTO joined_today FROM public.group_desk_welcomes w
     WHERE w.subgroup_id = grp AND w.user_id <> r.id AND w.created_at > now() - interval '24 hours';
    msg := NULL;

    IF r.streak >= 2 AND r.last_checkin = today - 1 THEN
      msg := 'Don''t lose your ' || r.streak || '-day streak 🔥 Check in today to keep it going and earn your points.';
      dest := '/';
    ELSIF r.newcomer AND welcome IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.replies x WHERE x.user_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM public.threads x WHERE COALESCE(x.author_id, x.user_id) = r.id AND NOT x.is_deleted) THEN
      msg := 'Your people in ' || r.lga || ' are waiting to meet you 👋🏾 Say hello on the welcome post and earn 5 points.';
      dest := '/thread/' || welcome || '?hello=1';
    ELSIF joined_today > 0 AND welcome IS NOT NULL THEN
      msg := joined_today || ' new member' || CASE WHEN joined_today = 1 THEN '' ELSE 's' END || ' joined ' || r.lga
             || ' LGA today. Say hi and make them feel at home! 🤗';
      dest := '/thread/' || welcome;
    ELSIF q.thread_id IS NOT NULL THEN
      msg := 'Today''s question: ' || q.question || ' Tell us your answer!';
      dest := '/thread/' || q.thread_id;
    ELSE
      msg := 'See what Abians are talking about today, and vote in a poll for 2 quick points. 🗳️';
      dest := '/polls';
    END IF;

    INSERT INTO public.notifications (user_id, type, message, link) VALUES (r.id, 'nudge', msg, dest);
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_daily_nudges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_daily_nudges() TO service_role;

-- The first newcomer reminder now points to the welcome thread too.
CREATE OR REPLACE FUNCTION public.send_newcomer_nudges()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  sent integer := 0;
  lga_group uuid;
  welcome uuid;
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
    welcome := CASE WHEN lga_group IS NULL THEN NULL ELSE public.group_welcome_thread(lga_group) END;

    IF r.stage = 1 THEN
      INSERT INTO public.notifications (user_id, type, message, link) VALUES (r.id, 'nudge',
        'Say hello to your people! 👋🏾 Introduce yourself on the welcome post: it earns points and only takes a minute.',
        CASE WHEN welcome IS NOT NULL THEN '/thread/' || welcome || '?hello=1' ELSE COALESCE('/subgroups/' || lga_group, '/subgroups') END);
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

-- 07:00 Lagos: the question. 18:00 Lagos: the reminders, when people are free.
DO $$ BEGIN PERFORM cron.unschedule('question-of-the-day'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('daily-nudges'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('question-of-the-day', '0 6 * * *', $$SELECT public.post_question_of_the_day()$$);
SELECT cron.schedule('daily-nudges', '0 17 * * *', $$SELECT public.send_daily_nudges()$$);

-- Today's question straight away.
SELECT public.post_question_of_the_day();

NOTIFY pgrst, 'reload schema';
