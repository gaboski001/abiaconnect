import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// The live tables and functions are newer than the generated types.
const sb = supabase as any

export type LiveRole = 'host' | 'moderator' | 'speaker' | 'listener'

export interface LiveStatus {
  allowed: boolean
  host_blocker: string | null
  room_minutes: number
  groups: { id: string; name: string }[]
}

export interface LiveRoomSummary {
  id: string
  title: string
  host_id: string
  host_name: string
  host_avatar: string | null
  subgroup_id: string | null
  group_name: string | null
  started_at: string
  ends_at: string
  listening: number
}

export interface LivePerson {
  user_id: string
  role: LiveRole
  hand_raised: boolean
  name: string
  avatar: string | null
}

export interface LiveRoomDetail {
  id: string
  title: string
  status: 'live' | 'ended'
  host_id: string
  subgroup_id: string | null
  group_name: string | null
  started_at: string
  ends_at: string
  ended_at: string | null
  ended_reason: string | null
  peak_listeners: number
  my_role: LiveRole | null
  people: LivePerson[]
}

export interface LiveComment {
  id: string
  user_id: string
  name: string
  avatar: string | null
  body: string
  is_pinned: boolean
  created_at: string
}

/** Plain words for the reasons the database and the live-room function give. */
const REASONS: Record<string, string> = {
  off: 'Live is not open to you yet.',
  sign_in: 'Please sign in first.',
  stopped: 'An admin has stopped you from hosting.',
  under_18: 'You need to be 18 or older to host.',
  too_new: 'Your account needs to be at least 30 days old to host.',
  level_or_plan: 'Reach Level 5 (Influencer), or be a Premium or VIP member, to host.',
  active_group: 'You need to run a group (as owner or champion) that has had a post in the last 14 days.',
  accept_rules: 'Please accept the room rules first.',
  title_too_short: 'Give your room a title of at least 3 letters.',
  pick_group: 'Pick one of your groups.',
  already_live: 'You already have a room live.',
  busy: 'Live is busy right now. Please try again a bit later.',
  month_used_up: 'Live is busy right now. Please try again a bit later.',
  ended: 'This room has ended.',
  removed: 'You can’t join this room.',
  full: 'This room is full right now.',
  not_allowed: 'Only the host or a moderator can do that.',
  not_in_room: 'That person has left the room.',
  moderators_full: 'A room can have 2 moderators at most.',
  stage_full: 'The stage is full (4 speakers). Move someone back first.',
  slow_down: 'Slow down a little, then try again.',
  empty: 'Please write something first.',
  not_set_up: 'Live isn’t set up yet. Please try again later.',
}

export function liveReason(code: string | null | undefined): string {
  if (!code) return 'Something went wrong. Please try again.'
  const key = code.replace(/^cannot_host:/, '')
  return REASONS[key] ?? 'Something went wrong. Please try again.'
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(liveReason(String(error.message ?? '').match(/^[a-z_:]+/)?.[0]))
  return data as T
}

/** Calls the live-room function; its { error } codes become plain words. */
export async function liveAction<T = { ok: true }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('live-room', { body })
  if (error) {
    let code: string | undefined
    try {
      code = (await (error as { context?: Response }).context?.json())?.error
    } catch {
      /* ignore */
    }
    throw new Error(liveReason(code))
  }
  return data as T
}

export const getLiveStatus = () => rpc<LiveStatus | null>('live_status')
export const listLiveRooms = () => rpc<LiveRoomSummary[]>('live_rooms_now').then((r) => r ?? [])
export const getLiveRoom = (id: string) => rpc<LiveRoomDetail | null>('live_room_detail', { _room_id: id })
export const listLiveComments = (id: string) =>
  rpc<LiveComment[]>('live_room_comments_list', { _room_id: id }).then((r) => (r ?? []).reverse())
export const startLiveRoom = (title: string, subgroupId: string | null) =>
  rpc<string>('live_start_room', { _title: title, _subgroup_id: subgroupId, _accept_rules: true })
export const liveHeartbeat = (id: string) =>
  rpc<{ status: 'live' | 'ended'; role: LiveRole | null; removed: boolean }>('live_heartbeat', { _room_id: id })
export const raiseHand = (id: string, up: boolean) => rpc<void>('live_raise_hand', { _room_id: id, _up: up })
export const postLiveComment = (id: string, body: string) => rpc<string>('live_comment', { _room_id: id, _body: body })
export const moderateLiveComment = (commentId: string, action: 'pin' | 'unpin' | 'delete') =>
  rpc<void>('live_moderate_comment', { _comment_id: commentId, _action: action })
export const reportLive = (roomId: string, userId: string | null, reason: string) =>
  rpc<void>('live_report', { _room_id: roomId, _user_id: userId, _reason: reason })

/** Whether Live shows for this member, and whether they can host. */
export function useLiveStatus() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['live-status', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    // Before the database update is applied the function is missing: treat as off.
    queryFn: () => getLiveStatus().catch(() => null),
  })
}

export function useLiveRooms(enabled: boolean) {
  return useQuery({ queryKey: ['live-rooms'], enabled, queryFn: listLiveRooms, refetchInterval: 30_000 })
}
