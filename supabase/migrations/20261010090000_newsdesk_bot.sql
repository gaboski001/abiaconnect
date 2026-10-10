-- Newsdesk bot: a daily discussion thread per forum, written from the day's news.
--
-- Every morning (07:30 Lagos) the daily-newsdesk edge function reads Nigerian
-- news feeds, picks at most one fresh story per forum (Abia stories first) and
-- writes a discussion starter. Everyday topics are published straight away;
-- posts for the sensitive forums, and any story that looks sensitive, wait in
-- Admin -> Newsdesk Bot for an admin to approve or reject.
--
--   newsdesk_settings   one row: on/off, the account it posts as, daily limit,
--                       which forums always need approval
--   newsdesk_posts      everything the bot wrote: waiting, published, rejected
--   newsdesk_runs       a line per run, so admins can see it worked (or why not)
--   thread_share_path() the share page (forum picture) for a bot thread
--
-- The bot starts switched OFF: an admin tries a test run first, then turns it on.

CREATE TABLE IF NOT EXISTS public.newsdesk_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_posts_per_day integer NOT NULL DEFAULT 8 CHECK (max_posts_per_day BETWEEN 1 AND 15),
  review_slugs text[] NOT NULL DEFAULT ARRAY['politics-governance', 'security-safety', 'health-wellness', 'faith-spirituality'],
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Posts as the account that wrote the October 2026 Newsdesk discussions, if it exists.
INSERT INTO public.newsdesk_settings (id, author_id)
SELECT true, (SELECT p.id FROM public.profiles p WHERE p.id = '2db15d64-4eb1-4bec-89f3-18f08d26c501')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.newsdesk_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsdesk_settings FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.newsdesk_settings TO authenticated;
GRANT ALL ON public.newsdesk_settings TO service_role;
DROP POLICY IF EXISTS "Admins read Newsdesk settings" ON public.newsdesk_settings;
CREATE POLICY "Admins read Newsdesk settings" ON public.newsdesk_settings
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins change Newsdesk settings" ON public.newsdesk_settings;
CREATE POLICY "Admins change Newsdesk settings" ON public.newsdesk_settings
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.newsdesk_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL, -- the day in Abia (Africa/Lagos)
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  category_slug text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('abia', 'wider')),
  title text NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{title, url, publisher}]
  hold_reason text, -- why it waited for an admin (NULL = published by itself)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL,
  share_path text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- At most one live post per forum per day, however many times the bot runs.
CREATE UNIQUE INDEX IF NOT EXISTS newsdesk_posts_one_per_forum_per_day
  ON public.newsdesk_posts (run_date, category_id) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS newsdesk_posts_status_created_idx ON public.newsdesk_posts (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS newsdesk_posts_thread_idx ON public.newsdesk_posts (thread_id) WHERE thread_id IS NOT NULL;

ALTER TABLE public.newsdesk_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsdesk_posts FROM anon, authenticated;
GRANT SELECT ON public.newsdesk_posts TO authenticated;
GRANT ALL ON public.newsdesk_posts TO service_role;
DROP POLICY IF EXISTS "Admins see Newsdesk posts" ON public.newsdesk_posts;
CREATE POLICY "Admins see Newsdesk posts" ON public.newsdesk_posts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.newsdesk_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL CHECK (trigger IN ('schedule', 'admin', 'test')),
  stories_found integer NOT NULL DEFAULT 0,
  published integer NOT NULL DEFAULT 0,
  held integer NOT NULL DEFAULT 0,
  note text -- what happened, in plain words (also the reason when nothing was posted)
);
CREATE INDEX IF NOT EXISTS newsdesk_runs_started_idx ON public.newsdesk_runs (started_at DESC);
ALTER TABLE public.newsdesk_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsdesk_runs FROM anon, authenticated;
GRANT SELECT ON public.newsdesk_runs TO authenticated;
GRANT ALL ON public.newsdesk_runs TO service_role;
DROP POLICY IF EXISTS "Admins see Newsdesk runs" ON public.newsdesk_runs;
CREATE POLICY "Admins see Newsdesk runs" ON public.newsdesk_runs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- The share page for a bot thread: its forum's picture, then on to the thread.
-- Used by the Share button and by "Share to Facebook". NULL for other threads.
CREATE OR REPLACE FUNCTION public.thread_share_path(_thread_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.share_path
    FROM public.newsdesk_posts n
    JOIN public.threads t ON t.id = n.thread_id
   WHERE n.thread_id = _thread_id
     AND n.status = 'published'
     AND NOT t.is_deleted
     AND n.share_path ~ '^/share/forum-[a-z0-9-]+\.html\?t=[0-9a-f-]{36}$'
   LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.thread_share_path(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.thread_share_path(uuid) TO anon, authenticated, service_role;

-- Tell every admin (once a day) that drafts are waiting for approval.
CREATE OR REPLACE FUNCTION public.newsdesk_notify_admins(_waiting integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := ((now() AT TIME ZONE 'Africa/Lagos')::date)::timestamp AT TIME ZONE 'Africa/Lagos';
  v_n integer;
BEGIN
  IF coalesce(_waiting, 0) <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT p.id, 'newsdesk',
         CASE WHEN _waiting = 1 THEN '1 Newsdesk post is waiting for your approval.'
              ELSE _waiting || ' Newsdesk posts are waiting for your approval.' END,
         '/admin/dashboard'
    FROM public.profiles p
   WHERE public.is_admin(p.id)
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id AND n.type = 'newsdesk' AND n.created_at >= v_start
     );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.newsdesk_notify_admins(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsdesk_notify_admins(integer) TO service_role;

-- Every day at 06:30 UTC = 07:30 Africa/Lagos (same sign-in as the other
-- scheduled jobs: public app key for the gateway, Vault scheduler token for
-- the function). The function does nothing while the bot is switched off.
DO $$
DECLARE v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN RETURN; END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'daily-newsdesk';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
  PERFORM cron.schedule(
    'daily-newsdesk',
    '30 6 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tnwgnowjmrbjugheorkv.supabase.co/functions/v1/daily-newsdesk',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud2dub3dqbXJianVnaGVvcmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTAwMjUsImV4cCI6MjA5Njc2NjAyNX0.Ph1TKiW1zxcmPwaTHd_FpOmZvTvlfwL650cvrgCr-X4',
        'x-cron-token', coalesce((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'abia_cron_token'), '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
    $cron$
  );
END $$;
