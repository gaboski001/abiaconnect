-- Greet a member straight away when they save a birthday that is today.
--
-- The daily job runs at 07:00-09:00 Lagos. A member who adds their date of
-- birth later on their birthday (for example from the new "Add your birthday"
-- prompt) would otherwise wait a whole year. When a member's dob is set or
-- changed to today's date (Lagos time; 29 Feb counts on 28 Feb in non-leap
-- years), this asks the birthday function to run now. The function greets
-- everyone due today and skips anyone already notified or emailed, so nobody
-- is greeted twice. At most 2 such calls per member per day.
-- Same sign-in as the scheduled jobs: public app key + Vault scheduler token.

CREATE OR REPLACE FUNCTION public.greet_birthday_if_today()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_m int;
  v_d int;
  v_due boolean;
  v_token text;
BEGIN
  IF NEW.dob IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.dob IS NOT DISTINCT FROM OLD.dob THEN RETURN NEW; END IF;
  IF coalesce(NEW.is_banned, false) OR coalesce(NEW.is_deleted, false) THEN RETURN NEW; END IF;

  v_m := extract(month FROM NEW.dob);
  v_d := extract(day FROM NEW.dob);
  v_due := (v_m = extract(month FROM v_today) AND v_d = extract(day FROM v_today))
        OR (v_m = 2 AND v_d = 29 AND extract(month FROM v_today) = 2 AND extract(day FROM v_today) = 28
            AND NOT (extract(year FROM v_today)::int % 4 = 0
                     AND (extract(year FROM v_today)::int % 100 <> 0 OR extract(year FROM v_today)::int % 400 = 0)));
  IF NOT v_due THEN RETURN NEW; END IF;

  -- Already greeted today?
  IF EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = NEW.id AND type = 'birthday'
       AND created_at >= (v_today::timestamp AT TIME ZONE 'Africa/Lagos')
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT public.consume_rate_limit('uid:' || NEW.id::text, 'birthday-on-save', 2, 86400) THEN
    RETURN NEW;
  END IF;

  IF to_regnamespace('net') IS NULL OR to_regnamespace('vault') IS NULL THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'abia_cron_token';
  IF v_token IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-birthday-greetings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
      'x-cron-token', v_token
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.greet_birthday_if_today() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS greet_birthday_if_today ON public.profiles;
CREATE TRIGGER greet_birthday_if_today
  AFTER INSERT OR UPDATE OF dob ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.greet_birthday_if_today();
