ALTER TABLE public.thread_votes
  DROP CONSTRAINT IF EXISTS thread_votes_thread_id_user_id_key;

ALTER TABLE public.thread_votes
  ADD CONSTRAINT thread_votes_thread_user_value_key
  UNIQUE (thread_id, user_id, value);