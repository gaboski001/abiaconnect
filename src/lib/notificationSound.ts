// Lightweight notification chime + vibration + mode preference (~1KB).
// Modes: 'sound' | 'vibrate' | 'muted'. Backwards-compatible with old boolean mute key.

const MODE_KEY = 'abia:notification-mode'
const LEGACY_MUTE_KEY = 'abia:notification-sound-muted'
const MODE_EVENT = 'abia:notification-mode-changed'

export type NotificationMode = 'sound' | 'vibrate' | 'muted'

export function getNotificationMode(): NotificationMode {
  if (typeof window === 'undefined') return 'sound'
  try {
    const v = window.localStorage.getItem(MODE_KEY)
    if (v === 'sound' || v === 'vibrate' || v === 'muted') return v
    // Legacy migration
    if (window.localStorage.getItem(LEGACY_MUTE_KEY) === '1') return 'muted'
    return 'sound'
  } catch {
    return 'sound'
  }
}

export function setNotificationMode(mode: NotificationMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MODE_KEY, mode)
    window.localStorage.setItem(LEGACY_MUTE_KEY, mode === 'muted' ? '1' : '0')
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { mode } }))
  } catch {
    // ignore
  }
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

function playChime() {
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
