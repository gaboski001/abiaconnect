-- Facebook-style reactions on threads. A reaction is a "like" (value 1) with a
-- kind, so points, counts and alerts keep working as before. No kind = Like.

ALTER TABLE public.thread_votes ADD COLUMN IF NOT EXISTS reaction text;
ALTER TABLE public.thread_votes DROP CONSTRAINT IF EXISTS thread_votes_reaction_check;
ALTER TABLE public.thread_votes ADD CONSTRAINT thread_votes_reaction_check
  CHECK (reaction IS NULL OR reaction IN ('like', 'love', 'haha', 'wow', 'sad', 'pray', 'clap'));

-- How many of each reaction a thread has (votes stay private; only totals are shown).
CREATE OR REPLACE FUNCTION public.get_thread_reactions(_thread_id uuid)
RETURNS TABLE(reaction text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(v.reaction, 'like') AS reaction, count(*)::bigint AS total
    FROM public.thread_votes v
   WHERE v.thread_id = _thread_id AND v.value = 1
   GROUP BY 1
   ORDER BY 2 DESC, 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_thread_reactions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_thread_reactions(uuid) TO anon, authenticated, service_role;

-- The author's alert says how people reacted.
CREATE OR REPLACE FUNCTION public.notify_thread_author_on_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_title  text;
  v_what   text;
BEGIN
  IF NEW.value <> 1 THEN
    RETURN NEW;
  END IF;
  SELECT author_id, title INTO v_author, v_title
  FROM public.threads WHERE id = NEW.thread_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  v_what := CASE COALESCE(NEW.reaction, 'like')
    WHEN 'love' THEN 'loved ❤️'
    WHEN 'haha' THEN 'laughed 😂 at'
    WHEN 'wow' THEN 'was amazed 😮 by'
    WHEN 'sad' THEN 'felt for 😢'
    WHEN 'pray' THEN 'sent prayers 🙏🏾 on'
    WHEN 'clap' THEN 'applauded 👏🏾'
    ELSE 'liked 👍🏾'
  END;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    v_author,
    'vote',
    'Someone ' || v_what || ' "' || COALESCE(v_title, 'your thread') || '"',
    '/thread/' || NEW.thread_id::text
  );
  RETURN NEW;
END;
$$;
