import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const plugin = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  verifyIdentity: vi.fn(),
  setCredentials: vi.fn(),
  getCredentials: vi.fn(),
  deleteCredentials: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capgo/capacitor-native-biometric', () => ({
  NativeBiometric: plugin,
  BiometryType: { FINGERPRINT: 3 },
  AuthenticationStrength: { NONE: 0, STRONG: 1, WEAK: 2 },
}))

import { describeBiometricError, enableBiometric, ownFingerprintCode, getBiometricCredentials, isBiometricAvailable } from './biometric'

// Asking for anything but strong unlock closes the app on Android (Play crash report, Nov 2026).
const STRONG_ONLY = expect.objectContaining({ allowedBiometryTypes: [3] })

describe('fingerprint sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    plugin.isAvailable.mockResolvedValue({ isAvailable: true, authenticationStrength: 1 })
    plugin.verifyIdentity.mockResolvedValue(undefined)
    plugin.setCredentials.mockResolvedValue(undefined)
    plugin.getCredentials.mockResolvedValue({ username: 'a@example.com', password: 'made-up' })
  })

  it('asks for strong unlock only when turning it on', async () => {
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toEqual({ ok: true })
    expect(plugin.verifyIdentity).toHaveBeenCalledWith(STRONG_ONLY)
  })

  it('asks for strong unlock only when signing in', async () => {
    localStorage.setItem('abia:biometric-enabled', 'true')
    await getBiometricCredentials()
    expect(plugin.verifyIdentity).toHaveBeenCalledWith(STRONG_ONLY)
  })

  it('does not offer it on a phone with only a weak face unlock', async () => {
    plugin.isAvailable.mockResolvedValue({ isAvailable: true, authenticationStrength: 2 })
    await expect(isBiometricAvailable()).resolves.toBe(false)
    const result = await getBiometricCredentials()
    expect(result.ok).toBe(false)
    expect(plugin.verifyIdentity).not.toHaveBeenCalled()
  })
})

describe('fingerprint sign-in: turning it on', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    plugin.verifyIdentity.mockResolvedValue(undefined)
  })

  it('allows several touches before giving up, not just one', async () => {
    await enableBiometric('a@example.com', 'made-up')
    expect(plugin.verifyIdentity).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 5 }))
  })

  it('says plainly why the phone refused', async () => {
    plugin.verifyIdentity.mockRejectedValue(Object.assign(new Error('Too many failed attempts'), { code: '4' }))
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toEqual({
      ok: false,
      cancelled: false,
      reason: 'Too many tries. Wait a moment, then try again.',
    })
  })

  it('treats pressing Cancel as cancelled, not as an error', async () => {
    plugin.verifyIdentity.mockRejectedValue(Object.assign(new Error('Cancel'), { code: '16' }))
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toMatchObject({ ok: false, cancelled: true })
  })

  it('passes on an unknown phone message word for word', async () => {
    expect(describeBiometricError(new Error('Biometric security check failed'))).toEqual({
      cancelled: false,
      reason: 'Your phone said: Biometric security check failed',
    })
  })
})

describe("fingerprint sign-in: the app's own fingerprint screen", () => {
  let answer: { ok: boolean; code?: number; message?: string }
  const own = {
    isAvailable: vi.fn(() => true),
    verify: vi.fn(() => {
      setTimeout(() => window.dispatchEvent(new CustomEvent('abia-fingerprint-result', { detail: answer })), 0)
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    answer = { ok: true, code: 0, message: '' }
    plugin.setCredentials.mockResolvedValue(undefined)
    plugin.getCredentials.mockResolvedValue({ username: 'a@example.com', password: 'made-up' })
    ;(window as unknown as { AbiaFingerprint?: unknown }).AbiaFingerprint = own
  })

  afterEach(() => {
    delete (window as unknown as { AbiaFingerprint?: unknown }).AbiaFingerprint
  })

  it('uses it instead of the add-on screen whose check fails on some phones', async () => {
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toEqual({ ok: true })
    expect(own.verify).toHaveBeenCalledTimes(1)
    expect(plugin.verifyIdentity).not.toHaveBeenCalled()
    await expect(getBiometricCredentials()).resolves.toEqual({ ok: true, creds: { username: 'a@example.com', password: 'made-up' } })
    expect(plugin.verifyIdentity).not.toHaveBeenCalled()
  })

  it('reports Cancel as cancelled and lockout as too many tries', async () => {
    answer = { ok: false, code: 13, message: 'Cancel' }
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toMatchObject({ ok: false, cancelled: true })
    answer = { ok: false, code: 7, message: 'Too many attempts' }
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toMatchObject({
      ok: false,
      reason: 'Too many tries. Wait a moment, then try again.',
    })
  })

  it('maps Android error numbers', () => {
    expect(ownFingerprintCode(10)).toBe('16')
    expect(ownFingerprintCode(9)).toBe('4')
    expect(ownFingerprintCode(11)).toBe('3')
    expect(ownFingerprintCode(12)).toBe('1')
  })
})
