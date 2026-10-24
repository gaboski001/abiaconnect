-- Facebook-style reactions on replies, the same way as on threads: a reaction
-- is a "like" (value 1) with a kind, so points and counts keep working.

ALTER TABLE public.reply_votes ADD COLUMN IF NOT EXISTS reaction text;
ALTER TABLE public.reply_votes DROP CONSTRAINT IF EXISTS reply_votes_reaction_check;
ALTER TABLE public.reply_votes ADD CONSTRAINT reply_votes_reaction_check
  CHECK (reaction IS NULL OR reaction IN ('like', 'love', 'haha', 'wow', 'sad', 'pray', 'clap'));

-- How many of each reaction the replies have (votes stay private; only totals are shown).
CREATE OR REPLACE FUNCTION public.get_reply_reactions(_reply_ids uuid[])
RETURNS TABLE(reply_id uuid, reaction text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.reply_id, COALESCE(v.reaction, 'like') AS reaction, count(*)::bigint AS total
    FROM public.reply_votes v
   WHERE v.reply_id = ANY (_reply_ids) AND v.value = 1
   GROUP BY 1, 2
$$;
REVOKE EXECUTE ON FUNCTION public.get_reply_reactions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reply_reactions(uuid[]) TO anon, authenticated, service_role;
