import { describe, expect, it } from 'vitest'
import { keyboardOverlap } from './useKeyboardInset'

describe('keyboardOverlap', () => {
  it('is zero while the keyboard is closed', () => {
    expect(keyboardOverlap(0, 800, 800)).toBe(0)
  })

  it('makes room when the screen did not shrink for the keyboard', () => {
    expect(keyboardOverlap(300, 800, 800)).toBe(300)
  })

  it('adds nothing when the screen already shrank, so no gap is left', () => {
    expect(keyboardOverlap(300, 800, 500)).toBe(0)
    expect(keyboardOverlap(348, 800, 500)).toBe(0)
  })
})
