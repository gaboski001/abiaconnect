DROP TRIGGER IF EXISTS trg_push_on_new_message ON public.messages;
CREATE TRIGGER trg_push_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.push_on_new_message();

DROP TRIGGER IF EXISTS trg_push_on_new_notification ON public.notifications;
CREATE TRIGGER trg_push_on_new_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.push_on_new_notification();