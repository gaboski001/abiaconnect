
SELECT cron.schedule(
  'daily-birthday-greetings',
  '0 6 * * *', -- 06:00 UTC = 07:00 Africa/Lagos
  $cron$
  SELECT net.http_post(
    url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-birthday-greetings',
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
