import { z } from 'zod'
import { supabase } from '@/integrations/supabase/client'

export const SEX_OPTIONS = ['male', 'female', 'other', 'prefer_not_to_say'] as const
export const MARITAL_STATUS_OPTIONS = [
  'single',
  'married',
  'in_relationship',
  'engaged',
  'divorced',
  'widowed',
  'separated',
  'prefer_not_to_say',
] as const

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
  current_location: z.string().trim().max(120, 'Current location is too long').optional(),
  occupation: z.string().trim().max(120, 'Occupation is too long').optional(),
  sex: z.enum(['', ...SEX_OPTIONS] as [string, ...string[]]).optional(),
  marital_status: z.enum(['', ...MARITAL_STATUS_OPTIONS] as [string, ...string[]]).optional(),
})

export type ProfileEditInput = z.infer<typeof profileEditSchema>

const editableProfileFields = [
  'display_name',
  'username',
  'bio',
  'lga',
  'current_location',
  'occupation',
  'sex',
  'marital_status',
] as const

type EditableProfileField = (typeof editableProfileFields)[number]
type ProfileUpdatePayload = Partial<Record<EditableProfileField, string | null>>

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

  const payload: ProfileUpdatePayload = {}
  for (const field of editableProfileFields) {
    if (!Object.prototype.hasOwnProperty.call(parsed.data, field)) continue

    const value = parsed.data[field]
    if (typeof value === 'string') {
      payload[field] = value.length > 0 ? value : null
    }
  }

  if (Object.keys(payload).length === 0) {
    return { error: { message: 'Nothing to update — change at least one profile field first.' } }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .maybeSingle()
  return { data, error }
}
