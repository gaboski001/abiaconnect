
-- 1. Tighten threads INSERT: private_author_id must equal auth.uid().
-- The threads_enforce_anonymity BEFORE INSERT trigger sets this from auth.uid()
-- anyway, so the WITH CHECK is satisfied for all legitimate inserts.
DROP POLICY IF EXISTS "Users create threads" ON public.threads;
CREATE POLICY "Users create threads"
ON public.threads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND is_pinned = false
  AND is_deleted = false
  AND upvotes = 0
  AND view_count = 0
  AND private_author_id = auth.uid()
);

-- 2. Reissue cron jobs using the service-role token stored in vault.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'weekly-subgroup-digest';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'cleanup-chat-attachments-hourly';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
END $$;

SELECT cron.schedule(
  'weekly-subgroup-digest',
  '0 8 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/weekly-subgroup-digest',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'cleanup-chat-attachments-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/cleanup-chat-attachments',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- 3. Update Facebook auto-post trigger function to use the service-role token
-- from vault rather than a hardcoded anon key, matching the new auth check
-- inside the post-thread-to-facebook edge function.
CREATE OR REPLACE FUNCTION public.notify_facebook_on_new_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/post-thread-to-facebook';
  service_key text;
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
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
