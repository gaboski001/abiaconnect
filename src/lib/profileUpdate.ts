import { z } from 'zod'
import { supabase } from '@/integrations/supabase/client'

export const profileEditSchema = z.object({
  display_name: z.string().trim().max(80, 'Display name is too long').optional(),
  username: z
    .string()
    .trim()
    .max(30, 'Username is too long')
    .regex(/^[a-zA-Z0-9_.]*$/, 'Use letters, numbers, "." or "_" only')
    .optional(),
  bio: z.string().trim().max(500, 'Bio must be 500 characters or less').optional(),
  lga: z.string().trim().max(60, 'LGA is too long').optional(),
})

export type ProfileEditInput = z.infer<typeof profileEditSchema>

/**
 * Updates the profile row for `userId`, sending ONLY the fields that have a
 * value. Prevents PostgREST's "Empty or invalid json object" error which fires
 * when the PATCH body is empty or contains only undefined values.
 */
export async function saveProfile(userId: string, raw: ProfileEditInput) {
  const parsed = profileEditSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }
  }
  const payload: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === 'string' && v.length > 0) payload[k] = v
  }
  if (Object.keys(payload).length === 0) {
    return { error: { message: 'Nothing to update — fill in at least one field.' } }
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(payload as ProfileEditInput)
    .eq('id', userId)
    .select()
    .maybeSingle()
  return { data, error }
}
