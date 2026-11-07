-- threads.best_reply_id must not be a foreign key. replies already points at
-- threads, and a second link in the other direction makes every "replies(count)"
-- read on threads ambiguous, so the forum could not load its discussions.
-- A best answer whose reply is later removed simply shows on no reply.
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_best_reply_id_fkey;

NOTIFY pgrst, 'reload schema';
