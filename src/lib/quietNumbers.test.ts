import { describe, expect, it } from 'vitest'
import { SHOW_COUNT_FROM, shownCount } from './quietNumbers'

describe('shownCount', () => {
  it('hides small or missing counts', () => {
    expect(shownCount(0)).toBeNull()
    expect(shownCount(SHOW_COUNT_FROM - 1)).toBeNull()
    expect(shownCount(null)).toBeNull()
    expect(shownCount(undefined)).toBeNull()
  })

  it('shows counts from the threshold up', () => {
    expect(shownCount(SHOW_COUNT_FROM)).toBe(SHOW_COUNT_FROM)
    expect(shownCount(250)).toBe(250)
    expect(shownCount(3, 1)).toBe(3)
  })
})
