import { supabase } from '@/lib/supabase'
import type { LookingFor } from '@/lib/relationship'

export interface ConnectSummary {
  followers: number
  following: number
  is_following: boolean
  photo_likes: Record<string, { likes: number; liked: boolean }>
}

export interface ConnectPerson {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
  looking_for: LookingFor | null
  photo_url: string | null
  happened_at: string
}

export interface ConnectPost {
  id: string
  title: string
  created_at: string
  place: string | null
  total: number
}

export type PeopleKind = 'followers' | 'following' | 'photo_likes'

type ToggleStatus = 'ok' | 'unavailable' | 'account_restricted'

// These functions arrived after the generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown>) => (supabase as any).rpc(name, args)

export async function getConnectSummary(userId: string): Promise<ConnectSummary | null> {
  const { data, error } = await rpc('connect_profile_summary', { _user: userId })
  if (error) throw error
  return (data as ConnectSummary | null) ?? null
}

export async function toggleFollow(
  userId: string,
): Promise<{ status: ToggleStatus; following?: boolean; followers?: number }> {
  const { data, error } = await rpc('connect_toggle_follow', { _target: userId })
  if (error) throw error
  return data
}

export async function togglePhotoLike(
  ownerId: string,
  photo: string,
): Promise<{ status: ToggleStatus; liked?: boolean; likes?: number }> {
  const { data, error } = await rpc('connect_toggle_photo_like', { _owner: ownerId, _photo: photo })
  if (error) throw error
  return data
}

export async function getMyPeople(kind: PeopleKind): Promise<ConnectPerson[]> {
  const { data, error } = await rpc('connect_my_people', { _kind: kind, _limit: 50, _offset: 0 })
  if (error) throw error
  return (data ?? []) as ConnectPerson[]
}

export async function searchConnectMembers(q: string): Promise<string[]> {
  const { data, error } = await rpc('connect_search', { _q: q })
  if (error) throw error
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id)
}

export async function getMemberPosts(userId: string): Promise<ConnectPost[]> {
  const { data, error } = await rpc('connect_member_posts', { _user: userId, _limit: 10 })
  if (error) throw error
  return (data ?? []) as ConnectPost[]
}
