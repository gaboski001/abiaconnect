import { describe, it, expect } from 'vitest'
import { toFriendlyAuthError } from './friendlyAuthError'

const BACKEND_HOST = 'tnwgnowjmrbjugheorkv.supabase.co'

describe('toFriendlyAuthError', () => {
  it.each([
    ['Token has expired', 'expired'],
    ['OTP already used', 'used'],
    ['Invalid token_hash', 'invalid'],
    ['failed to fetch https://tnwgnowjmrbjugheorkv.supabase.co/auth/v1/verify', 'network'],
    ['', 'unknown'],
  ])('classifies %p as %p', (input, kind) => {
    expect(toFriendlyAuthError(new Error(input)).kind).toBe(kind)
  })

  it('never leaks backend host in user-facing message', () => {
    const cases = [
      `Failed to fetch ${BACKEND_HOST}/auth/v1/verify`,
      `Invalid request to ${BACKEND_HOST}`,
      `at ${BACKEND_HOST}/rest/v1/profiles`,
      BACKEND_HOST,
    ]
    for (const c of cases) {
      const { message } = toFriendlyAuthError(new Error(c))
      expect(message).not.toContain(BACKEND_HOST)
      expect(message).not.toContain('supabase')
    }
  })

  it('never leaks raw error text', () => {
    const raw = 'PGRST301: JWT expired at row 42'
    const { message } = toFriendlyAuthError(new Error(raw))
    expect(message).not.toContain('PGRST')
    expect(message).not.toContain('JWT')
    expect(message).not.toContain('row 42')
  })
})
