-- The AbiaConnect desk welcomes every member the first time they introduce
-- themselves in a group: a warm reply by name, with the group's link and the
-- site's link to share, and an alert so they see it. Once per member per group.
-- An introduction is a reply to a group's welcome thread, any post under the
-- group's "Introduce yourself" topic, or a group post that reads like one.

CREATE TABLE IF NOT EXISTS public.group_desk_welcomes (
  subgroup_id uuid NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reply_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subgroup_id, user_id)
);
GRANT ALL ON public.group_desk_welcomes TO service_role;
ALTER TABLE public.group_desk_welcomes ENABLE ROW LEVEL SECURITY;

-- The account the desk posts as: the Newsdesk account, else the first Super Admin, else any admin.
CREATE OR REPLACE FUNCTION public.desk_account()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  who uuid;
BEGIN
  BEGIN
    SELECT author_id INTO who FROM public.newsdesk_settings WHERE id = true;
  EXCEPTION WHEN undefined_table THEN who := NULL;
  END;
  IF who IS NULL THEN
    SELECT ur.user_id INTO who FROM public.user_roles ur WHERE ur.role = 'Super Admin' ORDER BY ur.created_at LIMIT 1;
  END IF;
  IF who IS NULL THEN
    SELECT ur.user_id INTO who FROM public.user_roles ur WHERE ur.role = 'Admin' ORDER BY ur.created_at LIMIT 1;
  END IF;
  RETURN who;
END $$;
REVOKE EXECUTE ON FUNCTION public.desk_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desk_account() TO service_role;

-- Whether a post reads like someone introducing themselves.
CREATE OR REPLACE FUNCTION public.looks_like_intro(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(_text, '') ~* '(my name is|my name''s|introduc|hello everyone|hi everyone|hello all|hi all|greetings everyone|i am from|i''m from|i live in|ndewo|nnọọ|nnoo|kedu)'
$$;

-- Post the desk's welcome for one member in one group (does nothing the second time).
CREATE OR REPLACE FUNCTION public.desk_welcome(_subgroup uuid, _member uuid, _thread uuid, _parent_reply uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  desk uuid := public.desk_account();
  g public.subgroups%ROWTYPE;
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

  SELECT NULLIF(split_part(trim(COALESCE(p.display_name, '')), ' ', 1), '') INTO first_name
    FROM public.profiles p WHERE p.id = _member;
  first_name := COALESCE(first_name, 'friend');
  place := CASE WHEN g.kind = 'lga' AND g.lga IS NOT NULL THEN g.lga || ' LGA' ELSE g.name END;
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
  VALUES (_member, 'reply', 'The AbiaConnect Desk welcomed you to ' || place || ' 🎉', '/thread/' || _thread);
  RETURN reply;
END $$;
REVOKE EXECUTE ON FUNCTION public.desk_welcome(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desk_welcome(uuid, uuid, uuid, uuid) TO service_role;

-- A reply in a group: an introduction if it's on the welcome thread, under the
-- "Introduce yourself" topic, or reads like one.
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
    PERFORM public.desk_welcome(t.subgroup_id, NEW.user_id, NEW.thread_id, NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A welcome must never stop a member's reply from saving.
  RAISE WARNING 'desk welcome failed: %', SQLERRM;
  RETURN NEW;
END $$;

-- A new group post: an introduction if it's under "Introduce yourself" or reads like one.
CREATE OR REPLACE FUNCTION public.desk_welcome_on_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  topic text;
BEGIN
  IF NEW.subgroup_id IS NULL OR NEW.is_anonymous THEN RETURN NEW; END IF;
  SELECT st.name INTO topic FROM public.subgroup_topics st WHERE st.id = NEW.topic_id;
  IF topic = 'Introduce yourself' OR public.looks_like_intro(NEW.title || ' ' || COALESCE(NEW.content, '')) THEN
    PERFORM public.desk_welcome(NEW.subgroup_id, NEW.user_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'desk welcome failed: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS desk_welcome_on_reply ON public.replies;
CREATE TRIGGER desk_welcome_on_reply AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.desk_welcome_on_reply();
DROP TRIGGER IF EXISTS desk_welcome_on_thread ON public.threads;
CREATE TRIGGER desk_welcome_on_thread AFTER INSERT ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.desk_welcome_on_thread();

-- Catch up: welcome the introductions of the last 14 days that nobody welcomed yet.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (
      SELECT DISTINCT ON (x.subgroup_id, x.user_id) x.* FROM (
        SELECT th.subgroup_id, rp.user_id, rp.thread_id, rp.id AS parent, rp.created_at
          FROM public.replies rp
          JOIN public.threads th ON th.id = rp.thread_id
          LEFT JOIN public.subgroup_topics st ON st.id = th.topic_id
         WHERE th.subgroup_id IS NOT NULL AND rp.created_at > now() - interval '14 days'
           AND ('welcome' = ANY (COALESCE(th.tags, '{}')) OR st.name = 'Introduce yourself' OR public.looks_like_intro(rp.content))
        UNION ALL
        SELECT th.subgroup_id, th.user_id, th.id, NULL, th.created_at
          FROM public.threads th
          LEFT JOIN public.subgroup_topics st ON st.id = th.topic_id
         WHERE th.subgroup_id IS NOT NULL AND NOT th.is_anonymous AND NOT th.is_deleted
           AND th.created_at > now() - interval '14 days'
           AND (st.name = 'Introduce yourself' OR public.looks_like_intro(th.title || ' ' || COALESCE(th.content, '')))
      ) x
      ORDER BY x.subgroup_id, x.user_id, x.created_at
    ) firsts
    ORDER BY firsts.created_at
  LOOP
    PERFORM public.desk_welcome(r.subgroup_id, r.user_id, r.thread_id, r.parent);
  END LOOP;
END $$;
