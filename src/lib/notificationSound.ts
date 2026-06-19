// Lightweight notification chime + mute preference (no audio asset, ~1KB).
// Uses Web Audio API to synthesise a soft two-note tone on demand.

const STORAGE_KEY = 'abia:notification-sound-muted'
const SOUND_EVENT = 'abia:notification-sound-changed'

export function isNotificationSoundMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setNotificationSoundMuted(muted: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: { muted } }))
  } catch {
    // ignore
  }
}

export function subscribeNotificationSoundChanges(cb: (muted: boolean) => void) {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb(!!(e as CustomEvent).detail?.muted)
  window.addEventListener(SOUND_EVENT, handler)
  return () => window.removeEventListener(SOUND_EVENT, handler)
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

export function playNotificationChime() {
  if (isNotificationSoundMuted()) return
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

  tone(880, 0, 0.18) // A5
  tone(1318.5, 0.13, 0.22) // E6
}
