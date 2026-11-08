import { supabase } from '@/lib/supabase'

/* ---------------------------------------------------------------------------
 * Levels and badges (thresholds mirror public.points_level / check_badges in
 * supabase/migrations/20261001200000_forum_points_and_contests.sql).
 * ------------------------------------------------------------------------- */

export interface Level {
  level: number
  name: string
  min: number
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Newcomer', min: 0 },
  { level: 2, name: 'Member', min: 100 },
  { level: 3, name: 'Contributor', min: 300 },
  { level: 4, name: 'Active Voice', min: 700 },
  { level: 5, name: 'Influencer', min: 1500 },
  { level: 6, name: 'Community Elder', min: 3000 },
  { level: 7, name: 'Ambassador', min: 6000 },
]

export function levelFor(points: number): { current: Level; next: Level | null; progress: number } {
  let current = LEVELS[0]
  for (const l of LEVELS) if (points >= l.min) current = l
  const next = LEVELS.find((l) => l.min > points) ?? null
  const progress = next ? (points - current.min) / (next.min - current.min) : 1
  return { current, next, progress: Math.max(0, Math.min(1, progress)) }
}

export const BADGES: Record<string, { name: string; description: string; emoji: string }> = {
  first_post: { name: 'First Post', description: 'Started your first discussion', emoji: '✍️' },
  conversationalist: { name: 'Conversationalist', description: 'Posted 10 replies', emoji: '💬' },
  civic_voice: { name: 'Civic Voice', description: 'Voted in a poll or contest', emoji: '🗳️' },
  appreciated: { name: 'Appreciated', description: 'Received 25 upvotes', emoji: '👏' },
  streak_7: { name: 'Week Streak', description: 'Checked in 7 days in a row', emoji: '🔥' },
  streak_30: { name: 'Month Streak', description: 'Checked in 30 days in a row', emoji: '🏅' },
  rising_star: { name: 'Rising Star', description: 'Reached 300 points', emoji: '⭐' },
  influencer: { name: 'Influencer', description: 'Reached 1,500 points', emoji: '🌟' },
  new_abian: { name: 'New Abian', description: 'Finished the first 5 steps', emoji: '🏅' },
}

export const BADGE_ORDER = Object.keys(BADGES)

/** How members earn points (shown on the Rewards screen). */
export const EARNING_RULES: Array<{ reason: string; label: string; points: string; cap?: string }> = [
  { reason: 'daily_checkin', label: 'Daily check-in', points: '+10 to +22', cap: 'Grows with your streak' },
  { reason: 'thread', label: 'Start a discussion', points: '+15', cap: 'Up to 3 a day' },
  { reason: 'reply', label: 'Reply to a discussion', points: '+5', cap: 'Up to 20 a day' },
  { reason: 'thread_upvoted', label: 'Someone upvotes your post', points: '+2', cap: 'Up to 40 a day' },
  { reason: 'best_answer', label: 'Your reply is chosen as the best answer', points: '+25', cap: 'Up to 3 a day' },
  { reason: 'invite_first_post', label: 'Someone you invited makes a first post', points: '+30', cap: 'Up to 3 a day' },
  { reason: 'poll_vote', label: 'Vote in a poll', points: '+2' },
  { reason: 'contest_vote', label: 'Vote in a contest', points: '+5' },
  { reason: 'streak_bonus', label: '7-day / 30-day streak', points: '+20 / +100' },
  { reason: 'starter_bonus', label: 'Finish your first 5 steps', points: '+50', cap: 'Once' },
]

export const REASON_LABELS: Record<string, string> = {
  daily_checkin: 'Daily check-in',
  starter_bonus: 'First 5 steps bonus',
  streak_bonus: 'Streak bonus',
  thread: 'New discussion',
  reply: 'Reply',
  thread_upvoted: 'Your post was upvoted',
  reply_upvoted: 'Your reply was upvoted',
  best_answer: 'Best answer',
  invite_first_post: 'Your invite joined in',
  poll_vote: 'Poll vote',
  contest_vote: 'Contest vote',
  thread_removed: 'Post removed',
  admin_adjust: 'Adjustment',
}

/* ---------------------------------------------------------------------------
 * Rewards API
 * ------------------------------------------------------------------------- */

// The generated Database types don't include these new functions yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args)

export interface MyRewards {
  points: number
  level: number
  current_streak: number
  longest_streak: number
  claimed_today: boolean
  badges: Array<{ badge: string; awarded_at: string }>
  today: Record<string, number>
  recent: Array<{ amount: number; reason: string; created_at: string }>
}

export async function getMyRewards(): Promise<MyRewards> {
  const { data, error } = await rpc('get_my_rewards')
  if (error) throw error
  return data as MyRewards
}

export interface DailyClaim {
  claimed: boolean
  already_claimed: boolean
  streak: number
  points: number
  earned: number
  bonus?: number
}

export async function claimDailyReward(): Promise<DailyClaim> {
  const { data, error } = await rpc('claim_daily_reward')
  if (error) throw error
  return data as DailyClaim
}

export type LeaderboardPeriod = 'week' | 'month' | 'all'

export interface LeaderboardRow {
  rank: number
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  points: number
  level: number
}

export async function getLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardRow[]> {
  const { data, error } = await rpc('get_leaderboard', { _period: period, _limit: 50 })
  if (error) throw error
  return ((data ?? []) as LeaderboardRow[]).map((r) => ({ ...r, rank: Number(r.rank), points: Number(r.points) }))
}

export async function getMyRank(period: LeaderboardPeriod): Promise<{ rank: number | null; points: number }> {
  const { data, error } = await rpc('get_my_rank', { _period: period })
  if (error) throw error
  const d = (data ?? {}) as { rank: number | null; points: number }
  return { rank: d.rank == null ? null : Number(d.rank), points: Number(d.points ?? 0) }
}

/* ---------------------------------------------------------------------------
 * Contests API
 * ------------------------------------------------------------------------- */

export type ContestPhase = 'pending' | 'rejected' | 'cancelled' | 'upcoming' | 'open' | 'closed'

export interface ContestSummary {
  id: string
  title: string
  description: string | null
  subgroup_id: string | null
  created_by: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  starts_at: string
  ends_at: string
  results_visibility: 'live' | 'after_close'
  allow_group_voters: boolean
  allow_code_voters: boolean
  created_at: string
}

export interface ContestDetail {
  id: string
  title: string
  description: string | null
  subgroup_id: string | null
  subgroup_name: string | null
  status: ContestSummary['status']
  phase: ContestPhase
  allow_group_voters: boolean
  allow_code_voters: boolean
  results_visibility: 'live' | 'after_close'
  starts_at: string
  ends_at: string
  review_note: string | null
  is_manager: boolean
  signed_in: boolean
  members_before_open: boolean
  min_account_days: number
  is_public: boolean
  created_at: string
  positions: ContestPosition[]
  candidates: Array<{ id: string; position_id: string; name: string; bio: string | null; photo_url: string | null }>
  has_voted: boolean
  eligible_by_group: boolean
  /** Why this person can't vote through the group, or null when they can. */
  group_block: GroupBlock | null
  turnout: number
  /** How many group members may vote (when group members can vote). */
  eligible_members: number | null
  results: Array<{ candidate_id: string; position_id: string; votes: number }> | null
  results_announced_at: string | null
  codes: { total: number; used: number } | null
}

export interface ContestPosition {
  id: string
  title: string
  max_choices: number
}

export type GroupBlock = 'sign_in' | 'no_group_voting' | 'not_member' | 'joined_too_late' | 'account_too_new'

/** Plain words for why someone can't vote through the group. */
export const GROUP_BLOCK_TEXT: Record<GroupBlock, string> = {
  sign_in: 'Sign in to vote.',
  no_group_voting: 'This vote uses voter codes. Enter the code the organiser gave you.',
  not_member: 'Only members of this group can vote here.',
  joined_too_late: 'Only people who were already members of the group when this contest was created can vote. This keeps the vote fair.',
  account_too_new: 'Your account is too new to vote in this contest. This keeps the vote fair.',
}

/**
 * Who won each position. With "vote for up to N", the top N win. A tie at the
 * last winning place is flagged so nobody is wrongly declared the winner.
 */
export function positionWinners(
  candidateIds: string[],
  votesFor: (id: string) => number,
  maxChoices: number,
): { winners: string[]; tie: boolean } {
  const sorted = [...candidateIds].sort((a, b) => votesFor(b) - votesFor(a))
  if (!sorted.length || votesFor(sorted[0]) === 0) return { winners: [], tie: false }
  const seats = Math.min(maxChoices, sorted.length)
  const cutoff = votesFor(sorted[seats - 1])
  const next = sorted[seats] !== undefined ? votesFor(sorted[seats]) : -1
  if (cutoff > 0 && next === cutoff) {
    // Everyone above the tied mark wins; the tied ones need a decision.
    return { winners: sorted.filter((id) => votesFor(id) > cutoff), tie: true }
  }
  return { winners: sorted.slice(0, seats).filter((id) => votesFor(id) > 0), tie: false }
}

export function contestPhase(c: Pick<ContestSummary, 'status' | 'starts_at' | 'ends_at'>, now = Date.now()): ContestPhase {
  if (c.status !== 'approved') return c.status
  if (now < new Date(c.starts_at).getTime()) return 'upcoming'
  if (now < new Date(c.ends_at).getTime()) return 'open'
  return 'closed'
}

export async function listContests(): Promise<ContestSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)('contests')
    .select('id, title, description, subgroup_id, created_by, status, starts_at, ends_at, results_visibility, allow_group_voters, allow_code_voters, created_at')
    .order('ends_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as ContestSummary[]
}

export async function getContest(id: string): Promise<ContestDetail> {
  const { data, error } = await rpc('get_contest', { _contest: id })
  if (error) throw error
  const d = data as ContestDetail
  return {
    ...d,
    turnout: Number(d.turnout ?? 0),
    eligible_members: d.eligible_members == null ? null : Number(d.eligible_members),
    results: d.results ? d.results.map((r) => ({ ...r, votes: Number(r.votes) })) : null,
    codes: d.codes ? { total: Number(d.codes.total), used: Number(d.codes.used) } : null,
  }
}

export interface NewContest {
  title: string
  description: string
  subgroupId: string | null
  allowGroupVoters: boolean
  allowCodeVoters: boolean
  resultsVisibility: 'live' | 'after_close'
  startsAt: Date
  endsAt: Date
  candidates: Array<{ name: string; bio?: string; photo_url?: string }>
}

export async function createContest(c: NewContest): Promise<string> {
  const { data, error } = await rpc('create_contest', {
    _title: c.title,
    _description: c.description,
    _subgroup_id: c.subgroupId,
    _allow_group_voters: c.allowGroupVoters,
    _allow_code_voters: c.allowCodeVoters,
    _results_visibility: c.resultsVisibility,
    _starts_at: c.startsAt.toISOString(),
    _ends_at: c.endsAt.toISOString(),
    _candidates: c.candidates,
  })
  if (error) throw error
  return data as string
}

export interface NewElection {
  title: string
  description: string
  subgroupId: string | null
  allowGroupVoters: boolean
  allowCodeVoters: boolean
  resultsVisibility: 'live' | 'after_close'
  startsAt: Date
  endsAt: Date
  membersBeforeOpen: boolean
  minAccountDays: number
  isPublic: boolean
  positions: Array<{ title: string; max_choices: number; candidates: Array<{ name: string; bio?: string }> }>
}

export async function createElection(c: NewElection): Promise<string> {
  const { data, error } = await rpc('create_election', {
    _c: {
      title: c.title,
      description: c.description,
      subgroup_id: c.subgroupId,
      allow_group_voters: c.allowGroupVoters,
      allow_code_voters: c.allowCodeVoters,
      results_visibility: c.resultsVisibility,
      starts_at: c.startsAt.toISOString(),
      ends_at: c.endsAt.toISOString(),
      members_before_open: c.membersBeforeOpen,
      min_account_days: c.minAccountDays,
      is_public: c.isPublic,
      positions: c.positions,
    },
  })
  if (error) throw error
  return data as string
}

export async function castContestBallot(id: string, candidateIds: string[], code?: string) {
  const { error } = await rpc('cast_contest_ballot', { _contest: id, _choices: candidateIds, _code: code || null })
  if (error) throw error
}

/** Sends the "Results are out" notifications if nobody has yet. Safe to repeat. */
export async function announceContestResults(id: string) {
  await rpc('announce_contest_results', { _contest: id })
}

export async function reviewContest(id: string, approve: boolean, note?: string) {
  const { error } = await rpc('review_contest', { _contest: id, _approve: approve, _note: note ?? null })
  if (error) throw error
}

export async function cancelContest(id: string) {
  const { error } = await rpc('cancel_contest', { _contest: id })
  if (error) throw error
}

export async function castContestVote(id: string, candidateId: string, code?: string) {
  const { error } = await rpc('cast_contest_vote', { _contest: id, _candidate: candidateId, _code: code || null })
  if (error) throw error
}

export async function generateContestCodes(id: string, count: number): Promise<string[]> {
  const { data, error } = await rpc('generate_contest_codes', { _contest: id, _count: count })
  if (error) throw error
  return ((data ?? []) as Array<string | { generate_contest_codes: string }>).map((r) =>
    typeof r === 'string' ? r : r.generate_contest_codes,
  )
}

/** Plain-language messages for the server's error codes. */
export function engagementErrorText(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err ?? '')
  const map: Record<string, string> = {
    not_authenticated: 'Please sign in first.',
    not_allowed: 'You are not allowed to do that.',
    only_admins_or_group_owners: 'Only admins and group owners can create contests.',
    admins_only: 'Only admins can do that.',
    ends_in_past: 'The closing time must be in the future.',
    need_2_to_50_candidates: 'Add between 2 and 50 candidates.',
    not_found: 'This contest is not available.',
    not_started: 'Voting has not started yet.',
    voting_closed: 'Voting has closed.',
    invalid_candidate: 'Please choose a candidate from this contest.',
    not_eligible: 'Only members of this group can vote in this contest.',
    code_required: 'Enter your voter code to vote.',
    invalid_code: 'That voter code is not valid or has already been used.',
    already_voted: 'You have already voted in this contest.',
    codes_not_enabled: 'Voter codes are not turned on for this contest.',
    contest_closed: 'This contest is closed.',
    count_1_to_500: 'You can create between 1 and 500 codes at a time.',
    too_many_codes: 'This contest already has the maximum number of codes.',
    already_reviewed: 'This contest has already been reviewed.',
    cannot_cancel: 'This contest can no longer be cancelled.',
    too_many_choices: 'You picked more people than allowed for one of the positions.',
    choose_someone: 'Choose at least one candidate before submitting.',
    joined_too_late: 'Only people who were already members of the group when this contest was created can vote.',
    account_too_new: 'Your account is too new to vote in this contest.',
    need_1_to_15_positions: 'Add between 1 and 15 positions.',
    position_title_required: 'Give every position a name.',
    position_needs_candidates: 'Every position needs at least one candidate.',
    bad_max_choices: 'For each position, “vote for up to” can’t be more than the number of candidates.',
    need_2_to_100_candidates: 'Add between 2 and 100 candidates in total.',
    dates_required: 'Choose when voting opens and closes.',
  }
  for (const [code, text] of Object.entries(map)) if (msg.includes(code)) return text
  return 'Something went wrong. Please try again.'
}
