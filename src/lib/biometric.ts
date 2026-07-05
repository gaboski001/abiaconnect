/**
 * Biometric authentication helper — NATIVE-ONLY.
 *
 * Wraps `capacitor-native-biometric` for fingerprint / Face ID sign-in.
 * Stores the user's email + password in the device's secure keystore
 * (Android Keystore / iOS Keychain) so the user can unlock the app
 * without re-typing credentials.
 *
 * On the web (Lovable preview, abiaconnect.com), every function is a
 * no-op and `isBiometricAvailable()` resolves to `false` — so the web
 * bundle stays untouched.
 */
import { Capacitor } from '@capacitor/core'

import { NativeBiometric } from '@capgo/capacitor-native-biometric'

const SERVER = 'com.abiaconnect.app'
const ENABLED_KEY = 'abia:biometric-enabled'
const DECLINED_KEY = 'abia:biometric-declined'

export function hasDeclinedBiometric(): boolean {
  try {
    return localStorage.getItem(DECLINED_KEY) === 'true'
  } catch {
    return false
  }
}

export function setBiometricDeclined(declined: boolean): void {
  try {
    if (declined) localStorage.setItem(DECLINED_KEY, 'true')
    else localStorage.removeItem(DECLINED_KEY)
  } catch {
    /* ignore */
  }
}

type StoredCreds = { username: string; password: string }

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const res = await NativeBiometric.isAvailable()
    return res.isAvailable
  } catch {
    return false
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

export async function enableBiometric(email: string, password: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    // Verify once so the user explicitly consents.
    await NativeBiometric.verifyIdentity({
      reason: 'Enable biometric sign-in for AbiaConnect',
      title: 'Confirm it\'s you',
      subtitle: 'Future sign-ins will use your fingerprint or face',
    })
    await NativeBiometric.setCredentials({ username: email, password, server: SERVER })
    localStorage.setItem(ENABLED_KEY, 'true')
    return true
  } catch {
    return false
  }
}

export async function disableBiometric(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(ENABLED_KEY)
  } catch {
    /* ignore */
  }
}

export type BiometricError =
  | { kind: 'unsupported'; message: string }
  | { kind: 'not-enabled'; message: string }
  | { kind: 'cancelled'; message: string }
  | { kind: 'no-credentials'; message: string }
  | { kind: 'hardware-unavailable'; message: string }
  | { kind: 'unknown'; message: string }

export type BiometricResult =
  | { ok: true; creds: StoredCreds }
  | { ok: false; error: BiometricError }

export async function getBiometricCredentials(): Promise<BiometricResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      ok: false,
      error: {
        kind: 'unsupported',
        message: 'Biometric sign-in only works inside the AbiaConnect mobile app.',
      },
    }
  }

  // Hardware / OS-level availability check first so we can differentiate
  // "no fingerprint enrolled" from a user cancellation.
  try {
    const avail = await NativeBiometric.isAvailable()
    if (!avail.isAvailable) {
      return {
        ok: false,
        error: {
          kind: 'hardware-unavailable',
          message:
            'This device has no fingerprint or face unlock set up. Add one in your device settings, then try again.',
        },
      }
    }
  } catch {
    return {
      ok: false,
      error: {
        kind: 'hardware-unavailable',
        message: 'Biometric hardware is not available on this device.',
      },
    }
  }

  if (!isBiometricEnabled()) {
    return {
      ok: false,
      error: {
        kind: 'not-enabled',
        message:
          'Biometric sign-in isn\'t enabled yet. Sign in once with your email and password, then accept the biometric prompt to enable it.',
      },
    }
  }

  // Verify identity with the biometric prompt.
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to AbiaConnect',
      title: 'Confirm it\'s you',
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e ?? '')
    return {
      ok: false,
      error: {
        kind: 'cancelled',
        message: raw?.toLowerCase().includes('lock')
          ? 'Too many failed attempts — biometric is temporarily locked. Try again shortly or use your password.'
          : 'Biometric verification was cancelled. Try again or sign in with your password.',
      },
    }
  }

  // Fetch the stored credentials from the secure keystore.
  try {
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    if (!creds?.username || !creds?.password) {
      // Enabled flag was set but the keystore entry is gone — self-heal
      // so we don't get stuck in this state.
      try { localStorage.removeItem(ENABLED_KEY) } catch { /* ignore */ }
      return {
        ok: false,
        error: {
          kind: 'no-credentials',
          message:
            'Saved sign-in details are missing from this device. Please sign in with your password to set biometric up again.',
        },
      }
    }
    return { ok: true, creds: { username: creds.username, password: creds.password } }
  } catch {
    try { localStorage.removeItem(ENABLED_KEY) } catch { /* ignore */ }
    return {
      ok: false,
      error: {
        kind: 'no-credentials',
        message:
          'Couldn\'t read your saved sign-in details. Please sign in with your password to re-enable biometric.',
      },
    }
  }
}

