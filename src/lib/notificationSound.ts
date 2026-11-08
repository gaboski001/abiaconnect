// Lightweight notification chime + vibration + mode preference (~1KB).
// Modes: 'sound' | 'vibrate' | 'muted'. Persisted to user profile + localStorage cache.

import { supabase } from '@/integrations/supabase/client'
// AbiaConnect's own tune; the Android app plays the same one (res/raw/abia_chime.wav).
import chimeUrl from '@/assets/sounds/abia-chime.wav'

const MODE_KEY = 'abia:notification-mode'
const LEGACY_MUTE_KEY = 'abia:notification-sound-muted'
const MODE_EVENT = 'abia:notification-mode-changed'

export type NotificationMode = 'sound' | 'vibrate' | 'muted'

function isMode(v: unknown): v is NotificationMode {
  return v === 'sound' || v === 'vibrate' || v === 'muted'
}

export function getNotificationMode(): NotificationMode {
  if (typeof window === 'undefined') return 'sound'
  try {
    const v = window.localStorage.getItem(MODE_KEY)
    if (isMode(v)) return v
    if (window.localStorage.getItem(LEGACY_MUTE_KEY) === '1') return 'muted'
    return 'sound'
  } catch {
    return 'sound'
  }
}

function writeLocal(mode: NotificationMode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode)
    window.localStorage.setItem(LEGACY_MUTE_KEY, mode === 'muted' ? '1' : '0')
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { mode } }))
  } catch {
    // ignore
  }
}

export function setNotificationMode(mode: NotificationMode) {
  if (typeof window === 'undefined') return
  writeLocal(mode)
  // Best-effort sync to profile so it follows the user across devices.
  void (async () => {
    try {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) return
      await supabase
        .from('profiles')
        .update({ notification_mode: mode })
        .eq('id', uid)
    } catch {
      // ignore — local value still applied
    }
  })()
}

/** Fetch profile preference and apply it locally. Call after sign-in / on app boot. */
export async function syncNotificationModeFromProfile(): Promise<NotificationMode> {
  try {
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (!uid) return getNotificationMode()
    const { data } = await supabase
      .from('profiles')
      .select('notification_mode')
      .eq('id', uid)
      .maybeSingle()
    const remote = (data as { notification_mode?: string } | null)?.notification_mode
    if (isMode(remote) && remote !== getNotificationMode()) {
      writeLocal(remote)
      return remote
    }
  } catch {
    // ignore
  }
  return getNotificationMode()
}

export function subscribeNotificationModeChanges(cb: (mode: NotificationMode) => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb((e as CustomEvent).detail?.mode as NotificationMode)
  window.addEventListener(MODE_EVENT, handler)
  return () => window.removeEventListener(MODE_EVENT, handler)
}

// Legacy helpers (kept for any older imports)
export function isNotificationSoundMuted(): boolean {
  return getNotificationMode() !== 'sound'
}
export function setNotificationSoundMuted(muted: boolean) {
  setNotificationMode(muted ? 'muted' : 'sound')
}
export function subscribeNotificationSoundChanges(cb: (muted: boolean) => void) {
  return subscribeNotificationModeChanges((m) => cb(m !== 'sound'))
}

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    return ctx
  } catch {
    return null
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}

let tune: HTMLAudioElement | null = null

function playChime() {
  try {
    if (typeof Audio !== 'undefined') {
      tune ??= new Audio(chimeUrl)
      tune.volume = 0.7
      tune.currentTime = 0
      const played = tune.play()
      if (played && typeof played.catch === 'function') played.catch(() => playBeep())
      return
    }
  } catch {
    // fall back to the simple beep below
  }
  playBeep()
}

function playBeep() {
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume().catch(() => {})

  const now = ac.currentTime
  const master = ac.createGain()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  master.connect(ac.destination)

  const tone = (freq: number, start: number, dur: number) => {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + start)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, now + start)
    g.gain.linearRampToValueAtTime(1, now + start + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
    osc.connect(g).connect(master)
    osc.start(now + start)
    osc.stop(now + start + dur + 0.02)
  }

  tone(880, 0, 0.18)
  tone(1318.5, 0.13, 0.22)
}

export function playNotificationChime() {
  const mode = getNotificationMode()
  if (mode === 'muted') return
  if (mode === 'vibrate') {
    vibrate([60, 40, 80])
    return
  }
  playChime()
}

export function previewNotification(mode: NotificationMode) {
  if (mode === 'muted') return
  if (mode === 'vibrate') {
    vibrate([60, 40, 80])
    return
  }
  playChime()
}
