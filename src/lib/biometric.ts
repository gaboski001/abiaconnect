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

import { AuthenticationStrength, BiometryType, NativeBiometric } from '@capgo/capacitor-native-biometric'

const SERVER = 'com.abiaconnect.app'
const ENABLED_KEY = 'abia:biometric-enabled'
// v2: until 24 Nov 2026 tapping "Turn on" was wrongly saved as "Not now", so everyone is offered it once more.
const DECLINED_KEY = 'abia:biometric-declined-v2'

// The plugin's screen always uses a secure key, and Android closes the app if
// that screen also allows "weak" unlock methods. FINGERPRINT asks for strong
// ones only. Phones with only a weak face unlock count as having none.
const STRONG_ONLY = { allowedBiometryTypes: [BiometryType.FINGERPRINT] }

/**
 * The app's own fingerprint screen (window.AbiaFingerprint, app 1.1.5+). The add-on's screen
 * runs an extra key check after a good touch that always fails on some phones ("Biometric
 * security check failed"), so the app's own screen is used whenever it is there.
 */
type OwnFingerprint = {
  isAvailable?: () => boolean
  verify?: (title: string, subtitle: string, cancelText: string) => void
}
const ownFingerprint = (): OwnFingerprint | undefined =>
  (window as unknown as { AbiaFingerprint?: OwnFingerprint }).AbiaFingerprint

/** Android's fingerprint error numbers, turned into the add-on's codes used below. */
export function ownFingerprintCode(androidCode: number): string {
  if ([3, 5, 10, 13].includes(androidCode)) return '16' // timed out or cancelled
  if (androidCode === 7 || androidCode === 9) return '4' // too many tries
  if (androidCode === 11) return '3' // no fingerprint saved
  if (androidCode === 1 || androidCode === 12) return '1' // reader busy or missing
  return String(androidCode)
}

/** Asks for the phone owner's fingerprint; resolves when it matches, throws otherwise. */
async function confirmOwner(title: string, subtitle = ''): Promise<void> {
  const own = ownFingerprint()
  if (typeof own?.verify === 'function') {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => finish({ ok: false, code: 5, message: 'Cancel' }), 120_000)
      function finish(d: { ok?: boolean; code?: number; message?: string }) {
        window.clearTimeout(timer)
        window.removeEventListener('abia-fingerprint-result', onResult)
        if (d.ok) resolve()
        else reject(Object.assign(new Error(d.message || 'Fingerprint failed'), { code: ownFingerprintCode(Number(d.code ?? -1)) }))
      }
      function onResult(ev: Event) {
        finish(((ev as CustomEvent).detail ?? {}) as { ok?: boolean; code?: number; message?: string })
      }
      window.addEventListener('abia-fingerprint-result', onResult)
      own.verify!(title, subtitle, 'Cancel')
    })
    return
  }
  await NativeBiometric.verifyIdentity({
    ...STRONG_ONLY,
    maxAttempts: MAX_TOUCHES,
    reason: title,
    title: 'Confirm it’s you',
    ...(subtitle ? { subtitle } : {}),
  })
}

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
    const own = ownFingerprint()
    if (typeof own?.isAvailable === 'function') return own.isAvailable()
    const res = await NativeBiometric.isAvailable()
    return res.isAvailable && res.authenticationStrength === AuthenticationStrength.STRONG
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

/** Touches allowed before the fingerprint screen gives up (the plugin's maximum). */
const MAX_TOUCHES = 5

export type EnableResult = { ok: true } | { ok: false; cancelled: boolean; reason: string }

/** A plain sentence for why the phone refused, from the plugin's error code and text. */
export function describeBiometricError(e: unknown): { cancelled: boolean; reason: string } {
  const err = (e ?? {}) as { code?: unknown; message?: unknown }
  const code = String(err.code ?? '')
  const raw = typeof err.message === 'string' ? err.message : String(e ?? '')
  const text = raw.toLowerCase()
  if (code === '16' || code === '15' || text.includes('cancel')) {
    return { cancelled: true, reason: 'Fingerprint was cancelled.' }
  }
  if (code === '4' || code === '2' || text.includes('lock') || text.includes('too many')) {
    return { cancelled: false, reason: 'Too many tries. Wait a moment, then try again.' }
  }
  if (code === '3' || text.includes('no biometric') || text.includes('not enrolled')) {
    return { cancelled: false, reason: 'No fingerprint is saved on this phone. Add one in your phone settings first.' }
  }
  if (code === '1' || text.includes('hardware')) {
    return { cancelled: false, reason: 'The fingerprint reader is busy or not available. Try again.' }
  }
  return { cancelled: false, reason: raw ? `Your phone said: ${raw}` : 'Your phone did not allow it.' }
}

export async function enableBiometric(email: string, password: string): Promise<EnableResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, cancelled: false, reason: 'This only works in the AbiaConnect app.' }
  }
  try {
    // Verify once so the user explicitly consents.
    await confirmOwner('Turn on fingerprint sign-in for AbiaConnect', 'Future sign-ins will use your fingerprint')
  } catch (e) {
    return { ok: false, ...describeBiometricError(e) }
  }
  try {
    await NativeBiometric.setCredentials({ username: email, password, server: SERVER })
    localStorage.setItem(ENABLED_KEY, 'true')
    setBiometricDeclined(false)
    return { ok: true }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e ?? '')
    return {
      ok: false,
      cancelled: false,
      reason: `Your phone could not save your sign-in safely${raw ? ` (${raw})` : ''}.`,
    }
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
    if (!(await isBiometricAvailable())) {
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
    await confirmOwner('Sign in to AbiaConnect')
  } catch (e) {
    const { cancelled, reason } = describeBiometricError(e)
    return {
      ok: false,
      error: {
        kind: 'cancelled',
        message: cancelled
          ? 'Fingerprint was cancelled. Try again or sign in with your password.'
          : `${reason} You can also sign in with your password.`,
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

