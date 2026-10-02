-- Fix: the hourly chat-attachment cleanup was refused every hour (401) by the
-- Supabase gateway, before the function even started. The job still sent the
-- old stored service key (email_queue_service_role_key) in its Authorization
-- header, and that key is no longer accepted. The weekly digest and the
-- Facebook auto-post sent the same key.
--
-- Now every scheduled call sends:
--   Authorization: the project's PUBLIC app key (the same one in the website's
--     code). It only gets the request past the gateway; it grants nothing.
--   x-cron-token:  the secret scheduler token from Vault. This is what the
--     function itself checks before doing any work (see _shared/cron-auth.ts).
-- The old stored key is no longer sent anywhere.

CREATE OR REPLACE FUNCTION public.notify_facebook_on_new_thread()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fn_url text := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/post-thread-to-facebook';
  public_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4';
  cron_token text;
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO cron_token FROM vault.decrypted_secrets WHERE name = 'abia_cron_token';
  IF cron_token IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public_key,
      'x-cron-token', cron_token
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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), '')
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
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), '')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
END $$;
