/**
 * User-facing preference for the in-app calling feature.
 *
 * Persisted to the user's profile (`profiles.calls_enabled`) so it syncs
 * across devices, with a localStorage mirror for instant reads and offline
 * fallback. When calls are disabled:
 *   - Outgoing `startCall` throws with a friendly message the UI can toast.
 *   - Incoming `invite` broadcasts are silently declined so the caller sees
 *     the standard "user unavailable" cancel path.
 */

import { supabase } from '@/lib/supabase'

const KEY = 'abiaconnect:calls-enabled'
const EVENT = 'abiaconnect:calls-enabled-changed'

type Listener = (enabled: boolean) => void

function writeLocal(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent(EVENT, { detail: enabled }))
  } catch {
    /* ignore quota / private mode */
  }
}

export function areCallsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw === null) return true
    return raw !== 'false'
  } catch {
    return true
  }
}

/**
 * Update the preference. Writes the local mirror immediately and, when a
 * userId is supplied, persists to the user's profile so it syncs across
 * devices. Server write errors are logged but do not revert the local UI.
 */
export async function setCallsEnabled(
  enabled: boolean,
  opts?: { userId?: string | null },
): Promise<void> {
  writeLocal(enabled)
  const userId = opts?.userId
  if (!userId) return
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ calls_enabled: enabled })
      .eq('id', userId)
    if (error) console.warn('[callPreferences] failed to sync to profile:', error.message)
  } catch (err) {
    console.warn('[callPreferences] failed to sync to profile:', err)
  }
}

/**
 * Fetch the preference from the user's profile and mirror it locally.
 * Call once after sign-in and whenever the dashboard mounts.
 */
export async function hydrateCallsEnabledFromProfile(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return areCallsEnabled()
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('calls_enabled')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    // Missing row or null column → default enabled.
    const enabled = data?.calls_enabled !== false
    writeLocal(enabled)
    return enabled
  } catch (err) {
    console.warn('[callPreferences] failed to hydrate from profile:', err)
    return areCallsEnabled()
  }
}

export function subscribeCallsEnabled(fn: Listener): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<boolean>).detail
    fn(typeof detail === 'boolean' ? detail : areCallsEnabled())
  }
  const storageHandler = (e: StorageEvent) => {
    if (e.key === KEY) fn(areCallsEnabled())
  }
  window.addEventListener(EVENT, handler as EventListener)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener(EVENT, handler as EventListener)
    window.removeEventListener('storage', storageHandler)
  }
}
