-- lovable-cron-fallback-reviewed: contest closing times are known in advance; the owner's file requires a 10-minute results announcement sweep, and opening a closed contest also announces immediately.
-- Contests become proper elections and awards.
--
-- 1. Voter-list cut-off: a contest can count only members who were already in
--    the group when it was created, so nobody can flood a vote at the last
--    minute. Optionally, accounts must also be a minimum number of days old
--    when voting opens (group voters; code holders were picked by the organiser).
-- 2. Several positions in one election (Chairman, Secretary, ...), each with
--    "vote for up to N". One ballot per voter covers every position. Existing
--    contests get one position each, so nothing changes for them.
-- 3. Public follow link: anyone with the link, even signed out, can watch the
--    turnout and (when the organiser allowed it) the results. Only eligible
--    members can vote.
-- 4. Results are announced: when voting closes, the group, the voters and the
--    organiser get a notification. Runs every 10 minutes, and again whenever
--    someone opens a closed contest, so it never waits long.
-- The secret ballot is unchanged: ballots carry no voter, voters carry no choice.

-- Real table already has this; kept here so the test harness matches.
ALTER TABLE public.subgroup_members ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS members_before_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_account_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS results_announced_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.contests ADD CONSTRAINT contests_min_account_days_range CHECK (min_account_days BETWEEN 0 AND 365);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contest_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  max_choices integer NOT NULL DEFAULT 1 CHECK (max_choices BETWEEN 1 AND 10),
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS contest_positions_contest_idx ON public.contest_positions (contest_id, position);
ALTER TABLE public.contest_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contest_positions FROM anon, authenticated;

ALTER TABLE public.contest_candidates
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.contest_positions(id) ON DELETE CASCADE;

-- Every existing contest gets one position holding all its candidates.
DO $$
DECLARE c record; pid uuid;
BEGIN
  FOR c IN SELECT id FROM public.contests k
            WHERE NOT EXISTS (SELECT 1 FROM public.contest_positions p WHERE p.contest_id = k.id) LOOP
    INSERT INTO public.contest_positions (contest_id, title, max_choices, position)
    VALUES (c.id, 'Candidates', 1, 0) RETURNING id INTO pid;
    UPDATE public.contest_candidates SET position_id = pid WHERE contest_id = c.id AND position_id IS NULL;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Who may see a contest: as before, plus anyone (even signed out) when the
-- organiser turned on the public follow link.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_contest(_contest uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (_uid IS NOT DISTINCT FROM auth.uid() OR COALESCE(auth.role(), '') NOT IN ('anon', 'authenticated'))
    AND EXISTS (
    SELECT 1 FROM public.contests c
     LEFT JOIN public.subgroups g ON g.id = c.subgroup_id
     WHERE c.id = _contest
       AND (
         (c.status = 'approved' AND c.is_public)
         OR (_uid IS NOT NULL AND (
           c.created_by = _uid
           OR public.is_admin(_uid)
           OR (c.status = 'approved' AND (
                 c.subgroup_id IS NULL
                 OR NOT COALESCE(g.is_private, false)
                 OR c.allow_code_voters
                 OR public.is_subgroup_member(c.subgroup_id, _uid)))))
       )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_contest(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_contest(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone views public contests" ON public.contests;
CREATE POLICY "Anyone views public contests" ON public.contests
  FOR SELECT TO anon USING (status = 'approved' AND is_public);

-- ---------------------------------------------------------------------------
-- Why someone can or cannot vote through the group. NULL means they can.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contest_group_block(_contest uuid, _uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN 'sign_in'
    WHEN NOT c.allow_group_voters THEN 'no_group_voting'
    WHEN m.user_id IS NULL THEN 'not_member'
    WHEN c.members_before_open AND m.created_at >= c.created_at THEN 'joined_too_late'
    WHEN c.min_account_days > 0
         AND COALESCE(p.created_at, now()) > c.starts_at - make_interval(days => c.min_account_days) THEN 'account_too_new'
    ELSE NULL END
    FROM public.contests c
    LEFT JOIN public.subgroup_members m ON m.subgroup_id = c.subgroup_id AND m.user_id = _uid
    LEFT JOIN public.profiles p ON p.id = _uid
   WHERE c.id = _contest
$$;
REVOKE EXECUTE ON FUNCTION public.contest_group_block(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a contest with positions.
-- _c: { title, description, subgroup_id, allow_group_voters, allow_code_voters,
--       results_visibility, starts_at, ends_at, members_before_open,
--       min_account_days, is_public,
--       positions: [{ title, max_choices, candidates: [{ name, bio, photo_url }] }] }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_election(_c jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin boolean;
  new_id uuid;
  pid uuid;
  pos jsonb;
  cand jsonb;
  ppos integer := 0;
  cpos integer := 0;
  n_pos integer;
  n_cand integer;
  total integer := 0;
  maxc integer;
  admin_id uuid;
  v_title text := btrim(COALESCE(_c->>'title', ''));
  v_group uuid := NULLIF(_c->>'subgroup_id', '')::uuid;
  v_group_voters boolean := COALESCE((_c->>'allow_group_voters')::boolean, false);
  v_code_voters boolean := COALESCE((_c->>'allow_code_voters')::boolean, false);
  v_starts timestamptz := (_c->>'starts_at')::timestamptz;
  v_ends timestamptz := (_c->>'ends_at')::timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND (p.is_banned OR COALESCE(p.is_deleted, false))) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  admin := public.is_admin(uid);
  IF v_group IS NULL THEN
    IF NOT admin THEN RAISE EXCEPTION 'only_admins_or_group_owners'; END IF;
  ELSIF NOT public.is_subgroup_admin(v_group, uid) THEN
    RAISE EXCEPTION 'only_admins_or_group_owners';
  END IF;
  IF v_starts IS NULL OR v_ends IS NULL THEN RAISE EXCEPTION 'dates_required'; END IF;
  IF v_ends <= now() THEN RAISE EXCEPTION 'ends_in_past'; END IF;

  n_pos := COALESCE(jsonb_array_length(_c->'positions'), 0);
  IF n_pos < 1 OR n_pos > 15 THEN RAISE EXCEPTION 'need_1_to_15_positions'; END IF;
  FOR pos IN SELECT * FROM jsonb_array_elements(_c->'positions') LOOP
    n_cand := COALESCE(jsonb_array_length(pos->'candidates'), 0);
    maxc := COALESCE((pos->>'max_choices')::int, 1);
    IF char_length(btrim(COALESCE(pos->>'title', ''))) < 1 THEN RAISE EXCEPTION 'position_title_required'; END IF;
    IF n_cand < 1 THEN RAISE EXCEPTION 'position_needs_candidates'; END IF;
    IF maxc < 1 OR maxc > 10 OR maxc > n_cand THEN RAISE EXCEPTION 'bad_max_choices'; END IF;
    total := total + n_cand;
  END LOOP;
  IF total < 2 OR total > 100 THEN RAISE EXCEPTION 'need_2_to_100_candidates'; END IF;

  INSERT INTO public.contests (title, description, subgroup_id, created_by, status,
    allow_group_voters, allow_code_voters, results_visibility, starts_at, ends_at,
    members_before_open, min_account_days, is_public, reviewed_by, reviewed_at)
  VALUES (v_title, NULLIF(btrim(COALESCE(_c->>'description', '')), ''), v_group, uid,
    CASE WHEN admin THEN 'approved' ELSE 'pending' END,
    v_group_voters, v_code_voters,
    COALESCE(NULLIF(_c->>'results_visibility', ''), 'after_close'), v_starts, v_ends,
    COALESCE((_c->>'members_before_open')::boolean, false) AND v_group_voters,
    LEAST(365, GREATEST(0, COALESCE((_c->>'min_account_days')::int, 0))),
    COALESCE((_c->>'is_public')::boolean, false),
    CASE WHEN admin THEN uid END, CASE WHEN admin THEN now() END)
  RETURNING id INTO new_id;

  FOR pos IN SELECT * FROM jsonb_array_elements(_c->'positions') LOOP
    INSERT INTO public.contest_positions (contest_id, title, max_choices, position)
    VALUES (new_id, btrim(pos->>'title'), COALESCE((pos->>'max_choices')::int, 1), ppos)
    RETURNING id INTO pid;
    ppos := ppos + 1;
    FOR cand IN SELECT * FROM jsonb_array_elements(pos->'candidates') LOOP
      INSERT INTO public.contest_candidates (contest_id, position_id, name, bio, photo_url, position)
      VALUES (new_id, pid, btrim(cand->>'name'), NULLIF(btrim(COALESCE(cand->>'bio', '')), ''),
              NULLIF(btrim(COALESCE(cand->>'photo_url', '')), ''), cpos);
      cpos := cpos + 1;
    END LOOP;
  END LOOP;

  IF NOT admin THEN
    FOR admin_id IN SELECT p.id FROM public.profiles p WHERE public.is_admin(p.id) LOOP
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (admin_id, 'contest', 'A new contest is waiting for your approval: ' || v_title, '/contests?tab=review');
    END LOOP;
  ELSIF v_group_voters THEN
    -- Published straight away by an admin: tell the group, as an approval would.
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT m.user_id, 'contest', 'New vote in your group: ' || v_title, '/contests/' || new_id
      FROM public.subgroup_members m WHERE m.subgroup_id = v_group AND m.user_id <> uid;
  END IF;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_election(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_election(jsonb) TO authenticated;

-- The old form of create_contest still works: one position, pick one.
CREATE OR REPLACE FUNCTION public.create_contest(
  _title text, _description text, _subgroup_id uuid,
  _allow_group_voters boolean, _allow_code_voters boolean,
  _results_visibility text, _starts_at timestamptz, _ends_at timestamptz,
  _candidates jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer := COALESCE(jsonb_array_length(_candidates), 0);
BEGIN
  IF n < 2 OR n > 50 THEN RAISE EXCEPTION 'need_2_to_50_candidates'; END IF;
  RETURN public.create_election(jsonb_build_object(
    'title', _title, 'description', _description, 'subgroup_id', _subgroup_id,
    'allow_group_voters', _allow_group_voters, 'allow_code_voters', _allow_code_voters,
    'results_visibility', _results_visibility, 'starts_at', _starts_at, 'ends_at', _ends_at,
    'positions', jsonb_build_array(jsonb_build_object('title', 'Candidates', 'max_choices', 1, 'candidates', _candidates))));
END $$;
REVOKE EXECUTE ON FUNCTION public.create_contest(text, text, uuid, boolean, boolean, text, timestamptz, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_contest(text, text, uuid, boolean, boolean, text, timestamptz, timestamptz, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cast one ballot covering every position. _choices is an array of candidate
-- ids; a voter may leave a position blank but not pick more than allowed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_contest_ballot(_contest uuid, _choices jsonb, _code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.contests%ROWTYPE;
  block text;
  code_id uuid;
  picked uuid[];
  bad integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND (p.is_banned OR COALESCE(p.is_deleted, false))) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT * INTO c FROM public.contests WHERE id = _contest;
  IF NOT FOUND OR c.status <> 'approved' THEN RAISE EXCEPTION 'not_found'; END IF;
  IF now() < c.starts_at THEN RAISE EXCEPTION 'not_started'; END IF;
  IF now() >= c.ends_at THEN RAISE EXCEPTION 'voting_closed'; END IF;

  IF jsonb_typeof(_choices) <> 'array' THEN RAISE EXCEPTION 'invalid_candidate'; END IF;
  SELECT array_agg(DISTINCT x::uuid) INTO picked FROM jsonb_array_elements_text(_choices) x;
  IF picked IS NULL OR cardinality(picked) = 0 THEN RAISE EXCEPTION 'choose_someone'; END IF;
  IF cardinality(picked) <> jsonb_array_length(_choices) THEN RAISE EXCEPTION 'invalid_candidate'; END IF;
  IF (SELECT count(*) FROM public.contest_candidates k WHERE k.contest_id = _contest AND k.id = ANY (picked)) <> cardinality(picked) THEN
    RAISE EXCEPTION 'invalid_candidate';
  END IF;
  SELECT count(*) INTO bad FROM (
    SELECT k.position_id FROM public.contest_candidates k
      JOIN public.contest_positions p ON p.id = k.position_id
     WHERE k.id = ANY (picked)
     GROUP BY k.position_id, p.max_choices
    HAVING count(*) > p.max_choices) t;
  IF bad > 0 THEN RAISE EXCEPTION 'too_many_choices'; END IF;

  block := public.contest_group_block(_contest, uid);
  IF block IS NOT NULL THEN
    IF NOT c.allow_code_voters THEN
      RAISE EXCEPTION '%', CASE WHEN block IN ('joined_too_late', 'account_too_new') THEN block ELSE 'not_eligible' END;
    END IF;
    IF public.contest_code_normalize(_code) = '' THEN RAISE EXCEPTION 'code_required'; END IF;
    SELECT id INTO code_id FROM public.contest_voter_codes
     WHERE contest_id = _contest AND code_hash = public.contest_code_hash(_contest, _code) AND used_at IS NULL
     FOR UPDATE;
    IF code_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  END IF;

  BEGIN
    INSERT INTO public.contest_voters (contest_id, voter_key) VALUES (_contest, 'u:' || uid::text);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_voted';
  END;
  IF code_id IS NOT NULL THEN
    UPDATE public.contest_voter_codes SET used_at = now() WHERE id = code_id;
    INSERT INTO public.contest_voters (contest_id, voter_key) VALUES (_contest, 'c:' || code_id::text);
  END IF;
  -- Random order, so the rows of one ballot don't line up by choice order.
  INSERT INTO public.contest_ballots (contest_id, candidate_id)
  SELECT _contest, x FROM unnest(picked) x ORDER BY random();
  PERFORM public.award_points(uid, 5, 'contest_vote', _contest::text);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.cast_contest_ballot(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_contest_ballot(uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cast_contest_vote(_contest uuid, _candidate uuid, _code text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.cast_contest_ballot(_contest, jsonb_build_array(_candidate), _code) $$;
REVOKE EXECUTE ON FUNCTION public.cast_contest_vote(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_contest_vote(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- One contest: positions, candidates, the caller's voting status, turnout and,
-- when allowed, results.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contest(_contest uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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

-- ---------------------------------------------------------------------------
-- Announce results once voting has closed: the group, everyone who voted and
-- the organiser get a notification. Safe to call any number of times.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announce_contest_results(_contest uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.contests%ROWTYPE;
BEGIN
  UPDATE public.contests SET results_announced_at = now()
   WHERE id = _contest AND status = 'approved' AND ends_at <= now() AND results_announced_at IS NULL
  RETURNING * INTO c;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT DISTINCT u, 'contest', 'Results are out: ' || c.title, '/contests/' || c.id
    FROM (
      SELECT c.created_by AS u
      UNION SELECT m.user_id FROM public.subgroup_members m WHERE c.allow_group_voters AND m.subgroup_id = c.subgroup_id
      UNION SELECT substr(v.voter_key, 3)::uuid FROM public.contest_voters v WHERE v.contest_id = c.id AND v.voter_key LIKE 'u:%'
    ) t
   WHERE u IS NOT NULL;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.announce_contest_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.announce_contest_results(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.announce_due_contest_results()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE k uuid; n integer := 0;
BEGIN
  FOR k IN SELECT id FROM public.contests
            WHERE status = 'approved' AND ends_at <= now() AND results_announced_at IS NULL
            ORDER BY ends_at LIMIT 50 LOOP
    IF public.announce_contest_results(k) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.announce_due_contest_results() FROM PUBLIC, anon, authenticated;

-- Contests that closed before this change are treated as already announced,
-- so members don't get a burst of old news.
UPDATE public.contests SET results_announced_at = ends_at
 WHERE results_announced_at IS NULL AND ends_at <= now();

-- Schedule step: cron.schedule replaces any job with the same name, which is
-- what the repo file's unschedule-then-schedule block does.
SELECT cron.schedule('contest-results', '*/10 * * * *', $cron$SELECT public.announce_due_contest_results()$cron$);
