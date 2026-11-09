import { supabase } from '@/lib/supabase'

/** Today's month/day in the community's time zone (Lagos), as the emails use. */
function lagosToday(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {})
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
}

/** Today's date in Lagos as YYYY-MM-DD, e.g. to remember a choice for the day. */
export function lagosDateKey(now = new Date()): string {
  const t = lagosToday(now)
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/**
 * True when today (Lagos time) is the member's birthday. People born on
 * 29 February celebrate on 28 February in non-leap years.
 */
export function isBirthdayToday(dob: string | null | undefined, now = new Date()): boolean {
  if (!dob) return false
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob)
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  const today = lagosToday(now)
  if (month === today.month && day === today.day) return true
  return month === 2 && day === 29 && today.month === 2 && today.day === 28 && !isLeapYear(today.year)
}


// Celebrating together: who is celebrating today, wishes, and the privacy switch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args)

export interface BirthdayPerson {
  id: string
  name: string
  username: string | null
  avatar_url: string | null
  wishes: number
  wished: boolean
}

export interface BirthdayWish {
  from_id: string
  name: string
  avatar_url: string | null
  message: string
  from_team: boolean
  created_at: string
}

/** Quick wishes members can send with one tap. */
export const QUICK_WISHES = [
  'Happy birthday! 🎉 Wishing you joy, good health and many more years.',
  'Ụbọchị ọmụmụ ọma! 🎂 Chukwu gọzie gị.',
  'Happy birthday! May this new year bring you everything you hope for. 🙏🏾',
  'Many happy returns of the day! Enjoy your special day. 🥳',
]

export async function getBirthdaysToday(): Promise<BirthdayPerson[]> {
  const { data, error } = await rpc('birthdays_today')
  if (error) throw error
  return (data ?? []) as BirthdayPerson[]
}

export async function getMyBirthdayWishes(): Promise<BirthdayWish[]> {
  const { data, error } = await rpc('my_birthday_wishes')
  if (error) throw error
  return (data ?? []) as BirthdayWish[]
}

/** Returns false when this member had already sent a wish today. */
export async function sendBirthdayWish(to: string, message: string): Promise<boolean> {
  const { data, error } = await rpc('send_birthday_wish', { _to: to, _message: message })
  if (error) {
    if (/not_birthday/.test(error.message)) throw new Error('It is no longer their birthday.')
    if (/bad_message/.test(error.message)) throw new Error('Please write a wish of up to 280 characters.')
    throw error
  }
  return !(data as { already?: boolean } | null)?.already
}

export async function setShareBirthday(on: boolean): Promise<void> {
  const { error } = await rpc('set_share_birthday', { _on: on })
  if (error) throw error
}
