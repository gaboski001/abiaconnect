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

export async function getBiometricCredentials(): Promise<StoredCreds | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to AbiaConnect',
      title: 'Confirm it\'s you',
    })
    const creds = await NativeBiometric.getCredentials({ server: SERVER })
    if (!creds?.username || !creds?.password) return null
    return { username: creds.username, password: creds.password }
  } catch {
    return null
  }
}
