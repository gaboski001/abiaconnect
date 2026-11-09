import { supabase } from '@/lib/supabase'

/** Followers and Following lists, Unfollow and Remove follower. */

// These functions arrived after the generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args)

export type FollowKind = 'followers' | 'following'

export interface FollowPerson {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
  followed_at: string
  i_follow: boolean
  follows_me: boolean
}

export const FOLLOW_PAGE = 30

export async function getFollowList(userId: string, kind: FollowKind, q: string, offset: number): Promise<FollowPerson[]> {
  const { data, error } = await rpc('member_follow_list', {
    _user: userId,
    _kind: kind,
    _q: q.trim() || null,
    _limit: FOLLOW_PAGE,
    _offset: offset,
  })
  if (error) throw error
  return (data ?? []) as FollowPerson[]
}

export async function removeFollower(userId: string): Promise<void> {
  const { error } = await rpc('remove_follower', { _user: userId })
  if (error) throw error
}

export async function getMyFollowingIds(): Promise<string[]> {
  const { data, error } = await rpc('my_following_ids')
  if (error) throw error
  return (data ?? []) as string[]
}
