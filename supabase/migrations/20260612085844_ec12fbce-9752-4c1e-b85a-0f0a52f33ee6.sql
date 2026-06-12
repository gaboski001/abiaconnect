
-- Allow nested replies
ALTER TABLE public.replies ADD COLUMN IF NOT EXISTS parent_reply_id uuid REFERENCES public.replies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_replies_parent ON public.replies(parent_reply_id);

-- Reply votes table
CREATE TABLE IF NOT EXISTS public.reply_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id uuid NOT NULL REFERENCES public.replies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, user_id, value)
);
CREATE INDEX IF NOT EXISTS idx_reply_votes_reply ON public.reply_votes(reply_id);
CREATE INDEX IF NOT EXISTS idx_reply_votes_user ON public.reply_votes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_votes TO authenticated;
GRANT ALL ON public.reply_votes TO service_role;

ALTER TABLE public.reply_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reply votes"
  ON public.reply_votes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Aggregated counts RPC (anyone can read aggregates)
CREATE OR REPLACE FUNCTION public.get_reply_vote_counts(_reply_ids uuid[])
RETURNS TABLE(reply_id uuid, upvotes bigint, downvotes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    reply_id,
    sum(CASE WHEN value = 1 THEN 1 ELSE 0 END)::bigint AS upvotes,
    sum(CASE WHEN value = -1 THEN 1 ELSE 0 END)::bigint AS downvotes
  FROM public.reply_votes
  WHERE reply_id = ANY(_reply_ids)
  GROUP BY reply_id
$$;
