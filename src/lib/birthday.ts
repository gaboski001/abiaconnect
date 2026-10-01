/** Today's month/day in the community's time zone (Lagos), as the emails use. */
function lagosToday(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {})
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }
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

