import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * The volunteer team: what an approved volunteer can do, the moderators'
 * reported-posts queue, and the admin's team list. Database side:
 * supabase/migrations/20261109090000_volunteer_team_and_community_pages.sql.
 */

// These functions arrived after the generated database types.
const sb = supabase as any

export type TeamRole = 'moderator' | 'writer' | 'social' | 'developer' | 'connector' | 'other'

export const TEAM_ROLE_NAMES: Record<TeamRole, string> = {
  moderator: 'Community Moderator',
  writer: 'Content Writer',
  social: 'Social Media Coordinator',
  developer: 'Developer',
  connector: 'Community Connector',
  other: 'Volunteer',
}

/** What each role can do on the platform, in plain words. */
export const TEAM_ROLE_POWERS: Record<TeamRole, string> = {
  moderator: 'Reviews reported posts and hides ones that break the rules; reviews what members send in.',
  writer: 'Reviews and publishes success stories, events and Member of the Month.',
  social: 'Reviews and publishes success stories, events and Member of the Month.',
  connector: 'Champion of their LGA group: gets an alert when someone new says hello there.',
  developer: 'No extra tools in the app; works with our team directly.',
  other: 'No extra tools in the app; works with our team directly.',
}

export interface VolunteerPowers {
  role: TeamRole | null
  /** Can review reported posts. */
  moderate: boolean
  /** Can review stories, events and Member of the Month. */
  review: boolean
}

const NONE: VolunteerPowers = { role: null, moderate: false, review: false }

/** The signed-in member's volunteer tools (admins have all of them). */
export function useVolunteerPowers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['volunteer-powers', user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<VolunteerPowers> => {
      const { data, error } = await sb.rpc('my_volunteer_powers')
      // Before the database update runs, nobody has tools.
      if (error) return NONE
      return { ...NONE, ...(data as Partial<VolunteerPowers>) }
    },
  })
}

/** Switches on tools for a volunteer approved before they had an account. */
export async function claimVolunteerPowers(): Promise<TeamRole | null> {
  const { data, error } = await sb.rpc('claim_volunteer_powers')
  if (error) return null
  return (data as TeamRole | null) ?? null
}

// ---- Reported posts ----

export interface QueueItem {
  report_id: string
  reason: string | null
  reported_at: string
  target_type: 'thread' | 'reply'
  target_id: string
  thread_id: string | null
  title: string | null
  excerpt: string | null
  author_id: string | null
  author_name: string | null
  reports_on_post: number
}

export interface ModAction {
  id: string
  moderator_id: string
  moderator_name: string
  action: 'hide' | 'keep' | 'restore'
  target_type: 'thread' | 'reply'
  target_id: string
  thread_id: string | null
  excerpt: string | null
  undone_at: string | null
  created_at: string
}

export async function fetchModQueue(): Promise<QueueItem[]> {
  const { data, error } = await sb.rpc('mod_queue')
  if (error) throw new Error(teamError(error))
  return (data ?? []) as QueueItem[]
}

export async function modDecide(reportId: string, action: 'hide' | 'keep'): Promise<string> {
  const { data, error } = await sb.rpc('mod_decide', { _report: reportId, _action: action })
  if (error) throw new Error(teamError(error))
  return data as string
}

export async function modUndo(actionId: string) {
  const { error } = await sb.rpc('mod_undo', { _action: actionId })
  if (error) throw new Error(teamError(error))
}

export async function fetchModActions(limit = 50): Promise<ModAction[]> {
  const { data, error } = await sb.rpc('mod_recent_actions', { _limit: limit })
  if (error) throw new Error(teamError(error))
  return (data ?? []) as ModAction[]
}

// ---- Admin: the team ----

export interface TeamMember {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  role: TeamRole
  created_at: string
  from_application: boolean
}

export async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await sb.rpc('admin_volunteer_team')
  if (error) throw new Error(teamError(error))
  return (data ?? []) as TeamMember[]
}

/** role null ends their role. */
export async function setTeamRole(userId: string, role: TeamRole | null) {
  const { error } = await sb.rpc('admin_set_volunteer_role', { _user: userId, _role: role })
  if (error) throw new Error(teamError(error))
}

const MESSAGES: Record<string, string> = {
  not_allowed: 'This is only for the volunteer team.',
  not_admin: 'Only admins can do this.',
  already_handled: 'Someone on the team has already dealt with this report.',
  own_post: 'This report is about your own post, so another moderator will look at it.',
  daily_limit: 'You have hidden 50 posts today, which is the daily limit for volunteers. An admin can take over from here.',
  already_undone: 'This was already put back.',
  not_found: 'This post or report no longer exists.',
  role_invalid: 'Unknown role.',
}

export function teamError(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? ''
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k))
  return key ? MESSAGES[key] : 'Something went wrong. Please try again.'
}
