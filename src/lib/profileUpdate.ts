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
  // Used for the platform's birthday wishes (email, notification, home banner).
  dob: z
    .string()
    .trim()
    .refine((v) => v === '' || isValidDob(v), 'Enter a real date of birth (you must be at least 13)')
    .optional(),
})

/** YYYY-MM-DD, a real calendar date, not in the future, age 13 to 120. */
export function isValidDob(v: string, now = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false
  const age = now.getUTCFullYear() - y - (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d) ? 1 : 0)
  return age >= 13 && age <= 120
}

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
  'dob',
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
