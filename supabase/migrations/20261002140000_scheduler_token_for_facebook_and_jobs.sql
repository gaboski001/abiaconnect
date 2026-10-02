-- Fix: Facebook auto-post, hourly chat-attachment cleanup and the weekly
-- subgroup digest were refused by their edge functions ("Server
-- misconfigured"): the functions could only verify a service-role JWT with
-- SUPABASE_JWT_SECRET, which this project does not have. They now accept the
-- scheduler token in Vault ('abia_cron_token', created by the Ugo migration),
-- the same way Ugo and the birthday greetings already do. The service-role
-- Authorization header is still sent as a fallback.
-- Nothing becomes more open: the token is server-only and never reaches a browser.

CREATE OR REPLACE FUNCTION public.notify_facebook_on_new_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/post-thread-to-facebook';
  cron_token text;
  service_key text;
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO cron_token FROM vault.decrypted_secrets WHERE name = 'abia_cron_token';
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
  IF cron_token IS NULL AND service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', coalesce(cron_token, ''),
      'Authorization', 'Bearer ' || coalesce(service_key, '')
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

DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'weekly-subgroup-digest';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'weekly-subgroup-digest',
    '0 8 * * 1',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/weekly-subgroup-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), ''),
        'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'), '')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'cleanup-chat-attachments-hourly';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'cleanup-chat-attachments-hourly',
    '0 * * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/cleanup-chat-attachments',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), ''),
        'Authorization', 'Bearer ' || coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'), '')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
END $$;
