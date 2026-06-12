-- Notify thread author on new reply
CREATE OR REPLACE FUNCTION public.notify_thread_author_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_title  text;
BEGIN
  SELECT author_id, title INTO v_author, v_title
  FROM public.threads WHERE id = NEW.thread_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    v_author,
    'reply',
    'New reply on "' || COALESCE(v_title, 'your thread') || '"',
    '/thread/' || NEW.thread_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_reply ON public.replies;
CREATE TRIGGER notify_on_reply
AFTER INSERT ON public.replies
FOR EACH ROW EXECUTE FUNCTION public.notify_thread_author_on_reply();

-- Notify thread author on upvote
CREATE OR REPLACE FUNCTION public.notify_thread_author_on_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_title  text;
BEGIN
  IF NEW.value <> 1 THEN
    RETURN NEW;
  END IF;
  SELECT author_id, title INTO v_author, v_title
  FROM public.threads WHERE id = NEW.thread_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    v_author,
    'vote',
    'Someone upvoted "' || COALESCE(v_title, 'your thread') || '"',
    '/thread/' || NEW.thread_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_thread_vote ON public.thread_votes;
CREATE TRIGGER notify_on_thread_vote
AFTER INSERT ON public.thread_votes
FOR EACH ROW EXECUTE FUNCTION public.notify_thread_author_on_vote();

-- Index for notification fetch performance
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);