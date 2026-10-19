-- The "first 5 steps" bonus is a new reason for points: add it to the list
-- the points ledger accepts (the original list predates the newcomer journey).
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_reason_check;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_reason_check CHECK (reason IN (
  'daily_checkin', 'streak_bonus', 'thread', 'reply', 'thread_upvoted', 'reply_upvoted',
  'poll_vote', 'contest_vote', 'thread_removed', 'admin_adjust', 'starter_bonus'
));
