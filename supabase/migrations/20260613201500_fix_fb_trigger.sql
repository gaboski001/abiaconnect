CREATE OR REPLACE FUNCTION public.notify_facebook_on_new_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/post-thread-to-facebook';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4';
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'thread_id', NEW.id,
      'title', NEW.title,
      'is_anonymous', NEW.is_anonymous
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_facebook_on_new_thread ON public.threads;
CREATE TRIGGER trg_notify_facebook_on_new_thread
AFTER INSERT ON public.threads
FOR EACH ROW
EXECUTE FUNCTION public.notify_facebook_on_new_thread();
