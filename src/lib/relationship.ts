import { supabase } from '@/lib/supabase'
import { messagingRuleText } from '@/lib/monetization/strings'

export type LookingFor = 'friendship' | 'dating' | 'serious' | 'marriage' | 'networking'
export type RelSex = 'male' | 'female' | 'other' | 'prefer_not_to_say'
export type RelMarital =
  | 'single'
  | 'in_relationship'
  | 'engaged'
  | 'married'
  | 'divorced'
  | 'widowed'
  | 'complicated'
  | 'prefer_not_to_say'

export interface RelationshipProfile {
  id: string
  user_id: string
  headline: string | null
  about: string | null
  dob: string | null
  looking_for: LookingFor | null
  interests: string[]
  height_cm: number | null
  current_location: string | null
  occupation: string | null
  sex: RelSex | null
  marital_status: RelMarital | null
  lga: string | null
  photos: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RelationshipCard extends RelationshipProfile {
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

// Order matters: it is the order shown in filters and forms.
export const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  networking: 'Business & networking',
  friendship: 'Friendship',
  dating: 'Dating',
  serious: 'Long-term relationship',
  marriage: 'Marriage',
}

export function calcAge(dob?: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age > 0 && age < 130 ? age : null
}

/** Start (or reuse) a 1:1 conversation with a user and return the id. */
export async function startConversationWith(otherUserId: string, myUserId: string): Promise<string> {
  const [a, b] = [myUserId, otherUserId].sort()
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`)
    .maybeSingle()
  if (existing?.id) return existing.id as string
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user1_id: a, user2_id: b })
    .select('id')
    .single()
  if (error) throw new Error(messagingRuleText(error.message) ?? error.message)
  return created.id as string
}

export async function blockRelationshipUser(blockedId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')
  const { error } = await supabase
    .from('relationship_blocks' as never)
    .insert({ user_id: user.id, blocked_id: blockedId } as never)
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw error
}
