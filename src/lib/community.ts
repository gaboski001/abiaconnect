import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { feedFilter } from '@/lib/feed'
import { isValidHttpUrl } from '@/lib/images'
import type { LookingFor } from '@/lib/relationship'

/**
 * The forum's shared pieces: the post feed, member labels, public pages and the
 * things that bring people back. The database side is in
 * supabase/migrations/20261107140000_community_growth.sql. Anything that needs
 * that update quietly stays hidden until it has been run.
 */

// These functions arrived after the generated database types.
const sb = supabase as any

export type FeedTab = 'community' | 'my-lga' | 'following' | 'news' | 'popular' | 'unanswered'

export const FEED_TAB_LABELS: Record<FeedTab, string> = {
  community: 'From members',
  'my-lga': 'From your LGA',
  following: 'Following',
  news: 'News',
  popular: 'Popular',
  unanswered: 'Needs a reply',
}

export interface FeedPost {
  id: string
  title: string
  excerpt: string
  image: string | null
  created_at: string
  is_pinned: boolean
  is_anonymous: boolean
  upvotes: number
  author_id: string | null
  reply_count: number
  category: { id: string; name: string; icon: string | null } | null
  group: { name: string } | null
  author: { display_name: string | null; avatar_url: string | null; username: string | null; lga: string | null } | null
}

/** A post's text without its formatting, for the short preview on a card. */
export function postExcerpt(html: string | null | undefined, max = 180): string {
  const text = (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/** The first picture in a post, shown large on its card. */
export function postImage(html: string | null | undefined): string | null {
  const url = /<img[^>]+src=["']([^"']+)["']/i.exec(html ?? '')?.[1] ?? null
  return isValidHttpUrl(url) ? url : null
}

export async function loadFeed(opts: {
  tab: FeedTab
  lgaGroup: string | null
  newsdesk: string | null
  followingIds: string[]
  limit: number
}): Promise<FeedPost[]> {
  const { tab, lgaGroup, newsdesk, followingIds, limit } = opts
  if (tab === 'following' && !followingIds.length) return []
  let query = supabase
    .from('threads')
    .select(
      'id, title, content, created_at, is_pinned, is_anonymous, upvotes, view_count, author_id, replies(count), categories(id, name, icon), subgroups(name)',
    )
    .eq('is_deleted', false)
  // Members' posts (forum and groups) come first; the Newsdesk's news has its own tab.
  if (tab === 'my-lga' && lgaGroup) query = query.eq('subgroup_id', lgaGroup)
  else if (tab === 'following') query = query.in('author_id', followingIds).eq('is_anonymous', false)
  else if (tab === 'community' || tab === 'unanswered') query = feedFilter(query, 'community', newsdesk)
  else if (tab === 'news') query = feedFilter(query, 'news', newsdesk)
  else query = query.is('subgroup_id', null)
  if (tab === 'popular') {
    query = query.gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()).order('view_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }
  const { data, error } = await query.limit(tab === 'unanswered' ? 60 : limit)
  if (error) throw error
  const raw = (data ?? []) as any[]
  let rows = raw.map((r): FeedPost => ({
    id: r.id,
    title: r.title,
    excerpt: postExcerpt(r.content),
    image: postImage(r.content),
    created_at: r.created_at,
    is_pinned: !!r.is_pinned,
    is_anonymous: !!r.is_anonymous,
    upvotes: r.upvotes ?? 0,
    author_id: r.is_anonymous ? null : r.author_id ?? null,
    reply_count: r.replies?.[0]?.count ?? 0,
    category: (Array.isArray(r.categories) ? r.categories[0] : r.categories) ?? null,
    group: (Array.isArray(r.subgroups) ? r.subgroups[0] : r.subgroups) ?? null,
    author: null,
  }))
  if (tab === 'unanswered') rows = rows.filter((r) => r.reply_count === 0).slice(0, limit)
  const ids = Array.from(new Set(rows.map((r) => r.author_id).filter((v): v is string => !!v)))
  if (ids.length) {
    const { data: profs } = await supabase.rpc('get_public_profiles', { _ids: ids })
    const map = new Map(((profs ?? []) as any[]).map((p) => [p.id, p]))
    rows = rows.map((r) => ({ ...r, author: r.author_id ? map.get(r.author_id) ?? null : null }))
  }
  return rows
}

/* ------------------------------- Member labels ------------------------------- */

export interface MemberLabel {
  level: number
  trusted: boolean
}

export async function loadMemberLabels(ids: string[]): Promise<Record<string, MemberLabel>> {
  if (!ids.length) return {}
  const { data, error } = await sb.rpc('member_labels', { _ids: ids })
  if (error) return {}
  const out: Record<string, MemberLabel> = {}
  for (const row of (data ?? []) as Array<{ user_id: string; level: number; trusted: boolean }>) {
    out[row.user_id] = { level: row.level, trusted: row.trusted }
  }
  return out
}

/** Level and trusted mark for the people on screen. */
export function useMemberLabels(ids: Array<string | null | undefined>) {
  const clean = Array.from(new Set(ids.filter((v): v is string => !!v))).sort()
  return useQuery({
    queryKey: ['member-labels', clean],
    enabled: clean.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => loadMemberLabels(clean),
  }).data ?? {}
}

/** Who the signed-in member follows: for Follow buttons and the Following tab. */
export function useFollowingIds(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-following-ids', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await sb.rpc('connect_my_people', { _kind: 'following', _limit: 50 })
      if (error) return []
      return ((data ?? []) as Array<{ user_id: string }>).map((p) => p.user_id)
    },
  })
}

/* -------------------------------- Public page -------------------------------- */

export interface MemberPageData {
  occupation: string | null
  current_location: string | null
  has_connect: boolean
  looking_for: LookingFor | null
  photos: string[]
  headline: string | null
  work_experience: string | null
  business_name: string | null
  services: string | null
  badges: string[]
}

export async function getMemberPage(userId: string): Promise<MemberPageData | null> {
  const { data, error } = await sb.rpc('community_member_page', { _user: userId })
  if (error) return null
  return (data as MemberPageData | null) ?? null
}

/* ---------------------------- Discussions and answers ------------------------- */

export interface ThreadState {
  best_reply_id: string | null
  following: boolean
  is_mine: boolean
}

export async function getThreadState(threadId: string): Promise<ThreadState | null> {
  const { data, error } = await sb.rpc('thread_community_state', { _thread: threadId })
  if (error) return null
  return (data as ThreadState | null) ?? null
}

export async function toggleThreadFollow(threadId: string): Promise<boolean> {
  const { data, error } = await sb.rpc('toggle_thread_follow', { _thread: threadId })
  if (error) throw error
  return !!data
}

export async function setBestAnswer(threadId: string, replyId: string | null) {
  const { error } = await sb.rpc('set_best_answer', { _thread: threadId, _reply: replyId })
  if (error) throw error
}

/* ------------------------------- LGA of the month ----------------------------- */

export interface LgaScore {
  lga: string
  score: number
  replies: number
  best_answers: number
  new_members: number
}

export async function getLgaOfTheMonth(): Promise<LgaScore[]> {
  const { data, error } = await sb.rpc('lga_of_the_month')
  if (error) return []
  return ((data ?? []) as LgaScore[]).map((r) => ({ ...r, score: Number(r.score) }))
}

/* ---------------------------------- Invites ---------------------------------- */

const INVITE_KEY = 'abiaconnect_invite_code'

export interface MyInvite {
  code: string
  joined: number
  posted: number
}

export async function getMyInvite(): Promise<MyInvite | null> {
  const { data, error } = await sb.rpc('my_invite')
  if (error) return null
  return data as MyInvite
}

export function inviteLink(code: string): string {
  return `https://abiaconnect.com/register?ref=${code}`
}

/** Remember the invite from the link, so it survives signing up. */
export function rememberInvite(search: string) {
  const code = new URLSearchParams(search).get('ref')
  if (!code || !/^[a-f0-9]{10}$/.test(code)) return
  try {
    localStorage.setItem(INVITE_KEY, code)
  } catch {
    // Private browsing: the invite just isn't counted.
  }
}

/** Link a new member to whoever invited them, once they're signed in. */
export async function claimRememberedInvite() {
  let code: string | null = null
  try {
    code = localStorage.getItem(INVITE_KEY)
  } catch {
    return
  }
  if (!code) return
  const { error } = await sb.rpc('claim_invite', { _code: code })
  if (error) return
  try {
    localStorage.removeItem(INVITE_KEY)
  } catch {
    // Nothing to tidy up.
  }
}

/* -------------------------------- Jobs board --------------------------------- */

export type BoardKind = 'hiring' | 'work' | 'services' | 'networking'

export interface BoardMember {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  lga: string | null
  looking_for: LookingFor
  headline: string | null
  occupation: string | null
  business_name: string | null
  services: string | null
  work_experience: string | null
  updated_at: string
}

export async function getOpportunities(kind: BoardKind | null, lga: string | null): Promise<BoardMember[]> {
  const { data, error } = await sb.rpc('opportunities_board', { _kind: kind, _lga: lga })
  if (error) throw error
  return (data ?? []) as BoardMember[]
}

/* -------------------------------- Trusted mark -------------------------------- */

export interface TrustedRow {
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  created_at: string
}

export async function listTrusted(): Promise<TrustedRow[]> {
  const { data, error } = await sb.rpc('admin_list_trusted')
  if (error) throw error
  return (data ?? []) as TrustedRow[]
}

export async function setTrusted(userId: string, on: boolean) {
  const { error } = await sb.rpc('admin_set_trusted', { _user: userId, _on: on })
  if (error) throw error
}
