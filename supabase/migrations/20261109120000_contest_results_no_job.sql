-- Contest results without a job of their own (saves Cloud usage).
--
-- The 10-minute "contest-results" job is removed. Results are now announced:
--   * the moment anyone opens a contest after voting has closed (get_contest), and
--   * by the hourly "unanswered-alerts" job the database already runs, as a
--     backstop when nobody opens it. Same number of runs as before this feature.

DO $$ BEGIN PERFORM cron.unschedule('contest-results'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('unanswered-alerts');
  PERFORM cron.schedule('unanswered-alerts', '15 * * * *',
    $cron$SELECT public.alert_unanswered_posts(); SELECT public.announce_due_contest_results();$cron$);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.get_contest(_contest uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.contests%ROWTYPE;
  phase text;
  show_results boolean;
  is_manager boolean;
  block text;
BEGIN
  IF NOT public.can_view_contest(_contest, uid) THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO c FROM public.contests WHERE id = _contest;
  -- The first person to open a contest after voting closes sends the
  -- "Results are out" notifications (once).
  IF c.status = 'approved' AND now() >= c.ends_at AND c.results_announced_at IS NULL THEN
    PERFORM public.announce_contest_results(c.id);
    SELECT * INTO c FROM public.contests WHERE id = _contest;
  END IF;
  phase := CASE
    WHEN c.status <> 'approved' THEN c.status
    WHEN now() < c.starts_at THEN 'upcoming'
    WHEN now() < c.ends_at THEN 'open'
    ELSE 'closed' END;
  show_results := c.status = 'approved' AND (c.results_visibility = 'live' AND now() >= c.starts_at OR now() >= c.ends_at);
  is_manager := uid IS NOT NULL AND (c.created_by = uid OR public.is_admin(uid));
  block := public.contest_group_block(c.id, uid);
  RETURN jsonb_build_object(
    'id', c.id, 'title', c.title, 'description', c.description,
    'subgroup_id', c.subgroup_id,
    'subgroup_name', (SELECT g.name FROM public.subgroups g WHERE g.id = c.subgroup_id),
    'status', c.status, 'phase', phase,
    'allow_group_voters', c.allow_group_voters, 'allow_code_voters', c.allow_code_voters,
    'results_visibility', c.results_visibility,
    'members_before_open', c.members_before_open, 'min_account_days', c.min_account_days,
    'is_public', c.is_public, 'created_at', c.created_at,
    'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'review_note', CASE WHEN is_manager THEN c.review_note END,
    'is_manager', is_manager,
    'signed_in', uid IS NOT NULL,
    'positions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'max_choices', p.max_choices) ORDER BY p.position)
                           FROM public.contest_positions p WHERE p.contest_id = c.id), '[]'::jsonb),
    'candidates', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', k.id, 'position_id', k.position_id, 'name', k.name, 'bio', k.bio, 'photo_url', k.photo_url) ORDER BY k.position)
                            FROM public.contest_candidates k WHERE k.contest_id = c.id), '[]'::jsonb),
    'has_voted', uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.contest_voters v WHERE v.contest_id = c.id AND v.voter_key = 'u:' || uid::text),
    'eligible_by_group', block IS NULL,
    'group_block', block,
    'turnout', (SELECT count(*) FROM public.contest_voters v WHERE v.contest_id = c.id AND v.voter_key LIKE 'u:%'),
    'eligible_members', CASE WHEN c.allow_group_voters THEN (
        SELECT count(*) FROM public.subgroup_members m
          JOIN public.profiles p ON p.id = m.user_id
         WHERE m.subgroup_id = c.subgroup_id
           AND NOT COALESCE(p.is_banned, false) AND NOT COALESCE(p.is_deleted, false)
           AND (NOT c.members_before_open OR m.created_at < c.created_at)
           AND (c.min_account_days = 0 OR p.created_at <= c.starts_at - make_interval(days => c.min_account_days))) END,
    'results', CASE WHEN show_results THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object('candidate_id', k.id, 'position_id', k.position_id, 'votes',
                 (SELECT count(*) FROM public.contest_ballots b WHERE b.contest_id = c.id AND b.candidate_id = k.id)) ORDER BY k.position)
          FROM public.contest_candidates k WHERE k.contest_id = c.id), '[]'::jsonb) END,
    'results_announced_at', c.results_announced_at,
    'codes', CASE WHEN is_manager AND c.allow_code_voters THEN jsonb_build_object(
        'total', (SELECT count(*) FROM public.contest_voter_codes x WHERE x.contest_id = c.id),
        'used', (SELECT count(*) FROM public.contest_voter_codes x WHERE x.contest_id = c.id AND x.used_at IS NOT NULL)) END
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.get_contest(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contest(uuid) TO anon, authenticated;
