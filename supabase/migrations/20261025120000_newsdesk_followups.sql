-- The Desk joins Newsdesk discussions once members have replied: one note per
-- thread that sums up the views and asks a deeper question (daily-newsdesk).
-- This remembers which threads it has joined, so it never joins one twice.
CREATE TABLE IF NOT EXISTS public.newsdesk_followups (
  thread_id uuid PRIMARY KEY REFERENCES public.threads(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.replies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsdesk_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.newsdesk_followups FROM anon, authenticated;
GRANT ALL ON public.newsdesk_followups TO service_role;

NOTIFY pgrst, 'reload schema';
