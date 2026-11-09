-- The scheduled-job log (cron.job_run_details) was never trimmed and had grown
-- to about 1.1 GB of "job ran" lines. Keep one week of it, and trim it daily.
-- Owner approved deleting the older log lines (9 Nov 2026). Run live on 9 Nov:
-- 353,079 lines removed, then VACUUM FULL cron.job_run_details (run on its own,
-- outside a transaction) shrank the database from 1,146 MB to 30.5 MB.

DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days' OR (end_time IS NULL AND start_time < now() - interval '7 days');
DELETE FROM net._http_response WHERE created < now() - interval '7 days';

-- Every night at 00:45 UTC.
DO $do$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'trim-job-logs';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'trim-job-logs',
    '45 0 * * *',
    $cron$
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days' OR (end_time IS NULL AND start_time < now() - interval '7 days');
    DELETE FROM net._http_response WHERE created < now() - interval '7 days';
    $cron$
  );
END;
$do$;
