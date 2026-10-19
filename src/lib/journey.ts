import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/**
 * The newcomer journey: the welcome screen, the "first 5 steps" card, and the
 * simpler menu for new members. The database side is in
 * supabase/migrations/20261019120000_newcomer_journey.sql.
 */

/** Members who joined on or after this day see the welcome screen automatically. */
export const WELCOME_SINCE = '2026-10-19T00:00:00Z'
/** How long the "first 5 steps" card and the simpler menu last. */
export const NEWCOMER_DAYS = 21
export const SIMPLE_MENU_DAYS = 7
export const STARTER_BONUS = 50

export interface Interest {
  id: string
  label: string
  emoji: string
  /** Group categories that match this interest, for suggestions. */
  categories: string[]
}

export const INTERESTS: Interest[] = [
  { id: 'business', label: 'Business & trade', emoji: '💼', categories: ['Business', 'Real Estate', 'Agriculture'] },
  { id: 'jobs', label: 'Jobs & careers', emoji: '🧑🏾‍💼', categories: ['Career'] },
  { id: 'culture', label: 'Culture & heritage', emoji: '🥁', categories: ['Culture'] },
  { id: 'news', label: 'News & politics', emoji: '📰', categories: [] },
  { id: 'diaspora', label: 'Abians abroad', emoji: '✈️', categories: ['Diaspora'] },
  { id: 'education', label: 'School & ABSU', emoji: '🎓', categories: ['Education'] },
  { id: 'tech', label: 'Tech & innovation', emoji: '💻', categories: ['Technology'] },
  { id: 'health', label: 'Health & family', emoji: '🩺', categories: ['Health', 'Family'] },
  { id: 'sports', label: 'Sports, food & fun', emoji: '⚽', categories: ['Sports & Entertainment', 'Lifestyle'] },
  { id: 'faith', label: 'Faith', emoji: '🙏🏾', categories: [] },
  { id: 'meet', label: 'Meeting new people', emoji: '🤝🏾', categories: [] },
]

export type StepId = 'interests' | 'group' | 'vote' | 'hello' | 'photo'

export interface Journey {
  created_at: string
  onboarded_at: string | null
  lga: string | null
  interests: string[]
  lga_group: string | null
  bonus_claimed: boolean
  steps: Record<StepId, boolean>
}

export interface GroupLite {
  id: string
  name: string
  description: string | null
  category: string | null
  kind: 'lga' | 'interest'
  lga: string | null
  icon: string | null
  is_private: boolean
}

export interface GroupTopic {
  id: string
  subgroup_id: string
  name: string
  description: string | null
  emoji: string | null
  display_order: number
}

// The new functions and columns aren't in the generated types until the
// database update has been applied, so they are called loosely here.
type Loose = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  from: (table: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}
export const loose = supabase as unknown as Loose

export function daysSince(iso: string | null | undefined) {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

export function useJourney() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['journey', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await loose.rpc('get_my_journey')
      // Before the database update is applied this simply returns nothing.
      if (error) return null
      return (data ?? null) as Journey | null
    },
  })
}

export function useRefreshJourney() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['journey'] })
}

/** Joined recently enough to get the simpler menu. */
export function isNewcomer(journey: Journey | null | undefined, days = SIMPLE_MENU_DAYS) {
  return !!journey && daysSince(journey.created_at) < days
}

/** Should go to the welcome screen now. */
export function needsWelcome(journey: Journey | null | undefined) {
  if (!journey || journey.onboarded_at) return false
  if (new Date(journey.created_at) < new Date(WELCOME_SINCE)) return false
  try {
    return localStorage.getItem('abia.welcome-skipped') !== '1'
  } catch {
    return true
  }
}

export async function completeWelcome(interests: string[], groups: string[]) {
  const { data, error } = await loose.rpc('complete_welcome', { _interests: interests, _groups: groups })
  if (error) throw new Error(error.message)
  return data as { joined: number; greeted: number; lga_group: string | null }
}

export async function claimStarterBonus() {
  const { data, error } = await loose.rpc('claim_starter_bonus')
  if (error) throw new Error(error.message)
  return (data as number) ?? 0
}

export async function loadGroups(): Promise<GroupLite[]> {
  const { data, error } = await loose
    .from('subgroups')
    .select('id, name, description, category, kind, lga, icon, is_private')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as GroupLite[]
}

export async function loadTopics(groupId: string): Promise<GroupTopic[]> {
  const { data, error } = await loose
    .from('subgroup_topics')
    .select('id, subgroup_id, name, description, emoji, display_order')
    .eq('subgroup_id', groupId)
    .order('display_order')
  if (error) return []
  return (data ?? []) as GroupTopic[]
}

/** Groups that match someone's interests, best first, leaving out ones already chosen. */
export function suggestGroups(groups: GroupLite[], interests: string[], skip: Set<string> = new Set()) {
  const wanted = new Set(INTERESTS.filter((i) => interests.includes(i.id)).flatMap((i) => i.categories))
  return groups.filter((g) => g.kind !== 'lga' && !g.is_private && !skip.has(g.id) && g.category && wanted.has(g.category))
}
