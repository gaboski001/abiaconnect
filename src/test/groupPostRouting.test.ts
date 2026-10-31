import { describe, expect, it, vi } from 'vitest'
import { shouldReplyToWelcome } from '@/lib/journey'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }))

describe('group post routing', () => {
  const question = 'Hi all, does anyone know a good mechanic? I live in Umuahia'

  it.each(['Questions & help', 'Jobs', 'Events', undefined])('keeps the mechanic question as its own post under %s', (topic) => {
    expect(shouldReplyToWelcome('welcome-id', topic, false, question)).toBe(false)
  })

  it.each(['hello everyone', "I'm from Umuahia", 'hi all', 'I live in Aba'])('does not route an ordinary post because it contains %s', (greeting) => {
    expect(shouldReplyToWelcome('welcome-id', 'General chat', false, `${greeting}, I have a question about repairs.`)).toBe(false)
  })

  it('still routes an explicitly chosen introduction to the welcome thread', () => {
    expect(shouldReplyToWelcome('welcome-id', 'Introduce yourself', false, 'My name is Ada.')).toBe(true)
  })

  it('keeps anonymous introductions as posts', () => {
    expect(shouldReplyToWelcome('welcome-id', 'Introduce yourself', true, 'My name is Ada.')).toBe(false)
  })

  it('keeps introductions as posts when no welcome thread exists', () => {
    expect(shouldReplyToWelcome(null, 'Introduce yourself', false, 'My name is Ada.')).toBe(false)
  })

  it('does not route content beyond the reply limit', () => {
    expect(shouldReplyToWelcome('welcome-id', 'Introduce yourself', false, 'a'.repeat(5000))).toBe(true)
    expect(shouldReplyToWelcome('welcome-id', 'Introduce yourself', false, 'a'.repeat(5001))).toBe(false)
  })
})