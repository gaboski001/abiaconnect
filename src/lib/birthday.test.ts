import { describe, it, expect } from 'vitest'
import { isBirthdayToday } from './birthday'

describe('birthdays', () => {
  // 1 Oct 2026, 08:00 in Lagos
  const oct1 = new Date('2026-10-01T07:00:00Z')

  it('recognises today in Lagos time', () => {
    expect(isBirthdayToday('1990-10-01', oct1)).toBe(true)
    expect(isBirthdayToday('1990-10-02', oct1)).toBe(false)
    expect(isBirthdayToday(null, oct1)).toBe(false)
    // 23:30 UTC on 30 Sep is already 1 Oct in Lagos.
    expect(isBirthdayToday('1990-10-01', new Date('2026-09-30T23:30:00Z'))).toBe(true)
  })

  it('celebrates 29 February birthdays on 28 February in non-leap years', () => {
    expect(isBirthdayToday('2000-02-29', new Date('2027-02-28T10:00:00Z'))).toBe(true)
    expect(isBirthdayToday('2000-02-29', new Date('2028-02-28T10:00:00Z'))).toBe(false)
    expect(isBirthdayToday('2000-02-29', new Date('2028-02-29T10:00:00Z'))).toBe(true)
  })

})
