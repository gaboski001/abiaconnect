/**
 * User-facing preference for the in-app calling feature.
 *
 * Stored in localStorage so it persists per-device without a schema change.
 * When calls are disabled:
 *   - Outgoing `startCall` throws with a friendly message the UI can toast.
 *   - Incoming `invite` broadcasts are silently declined so the caller sees
 *     the standard "user unavailable" cancel path.
 */

const KEY = 'abiaconnect:calls-enabled'
const EVENT = 'abiaconnect:calls-enabled-changed'

type Listener = (enabled: boolean) => void

export function areCallsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(KEY)
    // Default to enabled when the user has never toggled it.
    if (raw === null) return true
    return raw !== 'false'
  } catch {
    return true
  }
}

export function setCallsEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent(EVENT, { detail: enabled }))
  } catch {
    /* ignore quota / private mode */
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
