-- The desk greeted members by the first word of their display name, which is
-- often the surname ("Onyejiuba Chinedu Emmanuel" became "Onyejiuba"). Use the
-- name they give in their own introduction ("my name is Chinedu"); without
-- one, use the whole display name rather than guess. Fixes earlier welcomes too.

-- The name a member gives in their introduction, else their whole display name.
CREATE OR REPLACE FUNCTION public.intro_first_name(_text text, _display text)
RETURNS text LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  t text := regexp_replace(COALESCE(_text, ''), '<[^>]+>', ' ', 'g');
  found text;
BEGIN
  found := substring(t from '(?i)(?:my name is|my name''s|my names are|call me|i am called|people call me)\s+([[:alpha:]''-]{2,})');
  IF found IS NULL THEN
    found := substring(t from '(?i)\m(?:i am|i''m|this is)\s+([[:alpha:]''-]{2,})');
    -- "I am from Aba", "I'm into tailoring": not names.
    IF lower(found) = ANY (ARRAY[
      'from', 'into', 'in', 'a', 'an', 'the', 'here', 'new', 'glad', 'happy', 'so', 'very', 'based', 'living',
      'interested', 'excited', 'also', 'not', 'just', 'currently', 'now', 'back', 'good', 'fine', 'ok', 'okay',
      'proud', 'delighted', 'thrilled', 'pleased', 'honoured', 'honored', 'looking', 'joining', 'member',
      'originally', 'staying', 'working', 'residing', 'married', 'single', 'at', 'on', 'of', 'with', 'to',
      'really', 'still', 'grateful', 'thankful', 'blessed', 'my', 'our', 'your', 'from', 'student', 'teacher',
      'trader', 'tailor', 'farmer', 'engineer', 'doctor', 'nurse', 'lawyer', 'pastor', 'retired', 'self'
    ]) THEN
      found := NULL;
    END IF;
  END IF;
  IF found IS NOT NULL THEN RETURN initcap(found); END IF;
  RETURN COALESCE(NULLIF(trim(regexp_replace(COALESCE(_display, ''), '\s+', ' ', 'g')), ''), 'friend');
END $$;
REVOKE EXECUTE ON FUNCTION public.intro_first_name(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intro_first_name(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.html_text(_s text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT replace(replace(replace(COALESCE(_s, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') $$;

-- The welcome now also takes the introduction's words, to find the member's name.
DROP FUNCTION IF EXISTS public.desk_welcome(uuid, uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.desk_welcome(_subgroup uuid, _member uuid, _thread uuid, _parent_reply uuid, _intro text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  desk uuid := public.desk_account();
  g public.subgroups%ROWTYPE;
  display text;
  first_name text;
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
  place := public.html_text(CASE WHEN g.kind = 'lga' AND g.lga IS NOT NULL THEN g.lga || ' LGA' ELSE g.name END);
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
  VALUES (_member, 'reply', 'The AbiaConnect Desk welcomed you to ' || CASE WHEN g.kind = 'lga' AND g.lga IS NOT NULL THEN g.lga || ' LGA' ELSE g.name END || ' 🎉', '/thread/' || _thread);
  RETURN reply;
END $$;
REVOKE EXECUTE ON FUNCTION public.desk_welcome(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desk_welcome(uuid, uuid, uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.desk_welcome_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  SELECT th.id, th.subgroup_id, th.tags, st.name AS topic INTO t
    FROM public.threads th LEFT JOIN public.subgroup_topics st ON st.id = th.topic_id
   WHERE th.id = NEW.thread_id;
  IF t.subgroup_id IS NULL THEN RETURN NEW; END IF;
  IF 'welcome' = ANY (COALESCE(t.tags, '{}')) OR t.topic = 'Introduce yourself' OR public.looks_like_intro(NEW.content) THEN
    PERFORM public.desk_welcome(t.subgroup_id, NEW.user_id, NEW.thread_id, NEW.id, NEW.content);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A welcome must never stop a member's reply from saving.
  RAISE WARNING 'desk welcome failed: %', SQLERRM;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.desk_welcome_on_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  topic text;
BEGIN
  IF NEW.subgroup_id IS NULL OR NEW.is_anonymous THEN RETURN NEW; END IF;
  SELECT st.name INTO topic FROM public.subgroup_topics st WHERE st.id = NEW.topic_id;
  IF topic = 'Introduce yourself' OR public.looks_like_intro(NEW.title || ' ' || COALESCE(NEW.content, '')) THEN
    PERFORM public.desk_welcome(NEW.subgroup_id, NEW.user_id, NEW.id, NULL, NEW.title || ' ' || COALESCE(NEW.content, ''));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'desk welcome failed: %', SQLERRM;
  RETURN NEW;
END $$;

-- Fix the welcomes already posted: put the right name in the first bold name.
WITH fixed AS (
  SELECT r.id,
         public.html_text(public.intro_first_name(
           COALESCE(parent.content, th.title || ' ' || COALESCE(th.content, '')),
           p.display_name)) AS name
    FROM public.group_desk_welcomes w
    JOIN public.replies r ON r.id = w.reply_id
    JOIN public.threads th ON th.id = r.thread_id
    LEFT JOIN public.replies parent ON parent.id = r.parent_reply_id
    LEFT JOIN public.profiles p ON p.id = w.user_id
)
UPDATE public.replies r
   SET content = regexp_replace(r.content, '<strong>[^<]*</strong>', '<strong>' || fixed.name || '</strong>')
  FROM fixed
 WHERE r.id = fixed.id;

NOTIFY pgrst, 'reload schema';
