DROP TRIGGER IF EXISTS trg_push_on_new_message ON public.messages;
CREATE TRIGGER trg_push_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.push_on_new_message();

DROP TRIGGER IF EXISTS trg_push_on_new_notification ON public.notifications;
CREATE TRIGGER trg_push_on_new_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_on_new_notification();

DROP TRIGGER IF EXISTS trg_notify_on_reply ON public.replies;
CREATE TRIGGER trg_notify_on_reply
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_thread_author_on_reply();

DROP TRIGGER IF EXISTS trg_notify_on_vote ON public.thread_votes;
CREATE TRIGGER trg_notify_on_vote
  AFTER INSERT ON public.thread_votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_thread_author_on_vote();