-- A pinned welcome thread in every public group (LGA groups first), filed under
-- "Introduce yourself", so new members have somewhere to say hello and a link
-- to invite their people. Plus two starter polls. Safe to run again: groups
-- that already have a welcome thread, and polls that already exist, are skipped.

DO $$
DECLARE
  author uuid;
  g record;
  intro uuid;
  link text;
  flavour text;
  body text;
  poll uuid;
BEGIN
  -- Posted by the site's first Super Admin (or any admin, or the Newsdesk account).
  SELECT ur.user_id INTO author FROM public.user_roles ur
   WHERE ur.role = 'Super Admin' ORDER BY ur.created_at LIMIT 1;
  IF author IS NULL THEN
    SELECT ur.user_id INTO author FROM public.user_roles ur
     WHERE ur.role = 'Admin' ORDER BY ur.created_at LIMIT 1;
  END IF;
  IF author IS NULL THEN
    SELECT author_id INTO author FROM public.newsdesk_settings WHERE id = true;
  END IF;
  IF author IS NULL THEN
    RAISE NOTICE 'No admin account found; no welcome threads were posted.';
    RETURN;
  END IF;

  FOR g IN
    SELECT s.id, s.name, s.kind, s.lga, s.description FROM public.subgroups s
     WHERE s.is_active AND NOT s.is_private
       AND NOT EXISTS (
         SELECT 1 FROM public.threads t
          WHERE t.subgroup_id = s.id AND t.user_id = author AND 'welcome' = ANY (t.tags) AND NOT t.is_deleted
       )
     ORDER BY (s.kind = 'lga') DESC, s.name
  LOOP
    SELECT st.id INTO intro FROM public.subgroup_topics st
     WHERE st.subgroup_id = g.id AND st.name = 'Introduce yourself' LIMIT 1;
    link := 'https://abiaconnect.com/subgroups/' || g.id;

    IF g.kind = 'lga' THEN
      flavour := CASE g.lga
        WHEN 'Aba North' THEN 'Enyimba City, where hard work, sharp business sense and "Made in Aba" pride never sleep'
        WHEN 'Aba South' THEN 'the heartbeat of Enyimba City, home of Ariaria market and the hustle that feeds a nation'
        WHEN 'Arochukwu' THEN 'the ancient land of the Aro, rich in history, culture and the colourful Ikeji festival'
        WHEN 'Bende' THEN 'a proud land of brave people, deep traditions and towns full of history'
        WHEN 'Ikwuano' THEN 'home of Umudike, its great university and research centres, where knowledge grows like yam'
        WHEN 'Isiala Ngwa North' THEN 'the heart of Ngwa land, where hospitality and good food are a way of life'
        WHEN 'Isiala Ngwa South' THEN 'proud Ngwa land of warm people, strong families and great farmland'
        WHEN 'Isuikwuato' THEN 'home of Uturu and its university, green hills and hardworking people'
        WHEN 'Obi Ngwa' THEN 'true Ngwa land, where the yam is king and every visitor is family'
        WHEN 'Ohafia' THEN 'the land of brave warriors and the famous war dance that makes the whole world stop and watch'
        WHEN 'Osisioma Ngwa' THEN 'the busy gateway to Aba, full of industry, enterprise and Ngwa warmth'
        WHEN 'Ugwunagbo' THEN 'a peaceful, hardworking land with big hearts and bigger dreams'
        WHEN 'Ukwa East' THEN 'home of Akwete, the land of the beautiful hand-woven Akwete cloth'
        WHEN 'Ukwa West' THEN 'a land of rivers, rich soil and resilient, welcoming people'
        WHEN 'Umuahia North' THEN 'the capital of God''s Own State, a city of history, government and green beauty'
        WHEN 'Umuahia South' THEN 'a beautiful land beside the capital, with strong communities and proud sons and daughters'
        WHEN 'Umunneochi' THEN 'the northern gateway of Abia, with cool hills and the famous market at Lokpa'
        ELSE 'our beloved home'
      END;
      body :=
        '<p><strong>Nnọọ! Ndewo nụ, ụmụnna anyị of ' || g.lga || '!</strong> 🎉🎉</p>' ||
        '<p>Welcome to the <strong>' || g.lga || ' LGA</strong> group on AbiaConnect, our own online village square for ' || flavour ||
        '. Whether you are at home, in Lagos, Abuja or anywhere in the diaspora, this is where we gist, share news from home, support each other and grow together. 💚</p>' ||
        '<h3>👋🏾 Kedu? Let''s meet you!</h3>' ||
        '<p>Reply to this post and tell us:</p><ul>' ||
        '<li>😊 Your name (a nickname is fine)</li>' ||
        '<li>🏡 Your town, village or community in ' || g.lga || '</li>' ||
        '<li>🌍 Where you live now</li>' ||
        '<li>🍲 One thing you miss or love about home: a food, a festival, a place, a memory</li></ul>' ||
        '<p>Short or long, every hello counts. And when someone new introduces themselves, reply with a warm <em>"Nnọọ!"</em> 🤗</p>' ||
        '<h3>🤝🏾 Onye aghala nwanne ya!</h3>' ||
        '<p>Let no one leave their brother or sister behind. Share this group with family and friends from ' || g.lga || ' so they can join us:</p>' ||
        '<p>👉🏾 <a href="' || link || '" target="_blank" rel="noopener noreferrer">' || link || '</a></p>' ||
        '<p>Send it to your family WhatsApp group, your age grade, your church or your old school friends. The more of us here, the sweeter the gist! 😄</p>' ||
        '<p><strong>Igwe bụ ike</strong>: together we are strong. Ka anyị kwụrụ ọnụ! 💪🏾💚</p>';

      INSERT INTO public.threads (subgroup_id, topic_id, user_id, author_id, title, content, tags, is_pinned, allow_replies, is_anonymous)
      VALUES (g.id, intro, author, author,
        'Nnọọ, ndị ' || g.lga || '! 👋🏾 Come in, introduce yourself and bring your people',
        body, ARRAY['welcome', 'introductions'], true, true, false);
    ELSE
      body :=
        '<p><strong>Nnọọ! Welcome to ' || g.name || '!</strong> 🎉</p>' ||
        '<p>' || COALESCE(NULLIF(g.description, ''), 'This is a group for Abians who share the same interest.') || '</p>' ||
        '<p>This is your space to learn, share, ask questions and meet people who care about the same things you do. No question is too small, and everyone here started as a newcomer. 💚</p>' ||
        '<h3>👋🏾 Kedu? Introduce yourself!</h3>' ||
        '<p>Reply to this post and tell us:</p><ul>' ||
        '<li>😊 Your name (a nickname is fine)</li>' ||
        '<li>📍 Your LGA or hometown, and where you live now</li>' ||
        '<li>💡 What brings you to this group, and one thing you hope to learn, share or find here</li></ul>' ||
        '<p>When someone new says hello, give them a warm <em>"Nnọọ!"</em> 🤗</p>' ||
        '<h3>🤝🏾 Bring your people</h3>' ||
        '<p>Know someone who would love this group? Share the link with them:</p>' ||
        '<p>👉🏾 <a href="' || link || '" target="_blank" rel="noopener noreferrer">' || link || '</a></p>' ||
        '<p><strong>Igwe bụ ike</strong>: together we are strong. Ka anyị kwụrụ ọnụ! 💪🏾</p>';

      INSERT INTO public.threads (subgroup_id, topic_id, user_id, author_id, title, content, tags, is_pinned, allow_replies, is_anonymous)
      VALUES (g.id, intro, author, author,
        'Nnọọ! 👋🏾 Welcome to ' || g.name || ': introduce yourself here',
        body, ARRAY['welcome', 'introductions'], true, true, false);
    END IF;
  END LOOP;

  -- Starter polls: what members want next, and a fun icebreaker.
  IF NOT EXISTS (SELECT 1 FROM public.polls WHERE question = 'What would make AbiaConnect even better for you? 💡') THEN
    -- A moment newer than the soup poll, so the home page asks this one first.
    INSERT INTO public.polls (question, created_by, is_active, created_at)
    VALUES ('What would make AbiaConnect even better for you? 💡', author, true, now() + interval '1 second') RETURNING id INTO poll;
    INSERT INTO public.poll_options (poll_id, text, created_at)
    SELECT poll, o.text, now() + (o.n * interval '1 millisecond') FROM (VALUES
      (1, '📰 More news and updates from my LGA'),
      (2, '💼 Jobs, business and opportunities'),
      (3, '🎉 Meetups and events near me'),
      (4, '🗣️ Learning Igbo language and culture'),
      (5, '🏆 More contests with prizes'),
      (6, '🛒 A marketplace to buy and sell')
    ) AS o(n, text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.polls WHERE question = 'Which Abia soup is the king of soups? 🍲') THEN
    INSERT INTO public.polls (question, created_by, is_active)
    VALUES ('Which Abia soup is the king of soups? 🍲', author, true) RETURNING id INTO poll;
    INSERT INTO public.poll_options (poll_id, text, created_at)
    SELECT poll, o.text, now() + (o.n * interval '1 millisecond') FROM (VALUES
      (1, 'Ofe Achara'),
      (2, 'Ukazi (Okazi)'),
      (3, 'Oha'),
      (4, 'Nsala (white soup)'),
      (5, 'Egusi'),
      (6, 'Okro')
    ) AS o(n, text);
  END IF;
END $$;
