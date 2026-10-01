-- Fix: "Some access rules let everyone through" (member_stats, member_badges).
-- Both tables had a SELECT rule USING (true), so any signed-in member could
-- read every member's points, streaks and badges directly. Nothing in the app
-- needs that: the leaderboard and rewards screens use SECURITY DEFINER
-- functions (get_leaderboard, get_my_rank, get_my_rewards) that return only
-- what is shown. Members may now read only their own rows.
-- No data changes; writes stay server-only as before.

DROP POLICY IF EXISTS "Members can see community stats" ON public.member_stats;
DROP POLICY IF EXISTS "Members read their own stats" ON public.member_stats;
CREATE POLICY "Members read their own stats" ON public.member_stats
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can see badges" ON public.member_badges;
DROP POLICY IF EXISTS "Members read their own badges" ON public.member_badges;
CREATE POLICY "Members read their own badges" ON public.member_badges
  FOR SELECT TO authenticated USING (user_id = auth.uid());
