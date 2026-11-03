import { describe, expect, it } from 'vitest'
import { makeUsername } from './username'

describe('makeUsername', () => {
  const fixed = () => 0.5

  it('turns a name into letters, numbers and underscores', () => {
    expect(makeUsername('Chidi Okafor', fixed)).toBe('chidi_okafor_5500')
    expect(makeUsername("  Ngozi O'Neil-Eze ", fixed)).toBe('ngozi_o_neil_eze_5500')
    expect(makeUsername('Ọbịnna Ụkwụ', fixed)).toBe('obinna_ukwu_5500')
  })

  it('falls back when the name has no usable letters', () => {
    expect(makeUsername('👋🏾', fixed)).toBe('abian_5500')
  })

  it('stays short', () => {
    expect(makeUsername('a'.repeat(60), fixed).length).toBeLessThanOrEqual(25)
  })
})
