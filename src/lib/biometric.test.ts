import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { enableBiometric, getBiometricCredentials, isBiometricAvailable } from './biometric'

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
    await expect(enableBiometric('a@example.com', 'made-up')).resolves.toBe(true)
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
