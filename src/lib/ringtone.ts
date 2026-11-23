/**
 * Call sounds.
 * - Incoming: in the Android app (1.1.4+) the phone's own ringtone, played by
 *   the app itself, exactly like a normal phone call. Elsewhere a ringing
 *   melody made with WebAudio, clearly different from the dialling sound.
 * - Outgoing (the caller hears this while the other phone rings): the classic
 *   440 Hz + 480 Hz ringback beep, quietly.
 *
 * The WebAudio player is shut down completely when the sound stops, so it
 * never keeps hold of the phone's sound output once the call itself starts
 * (a lingering player could leave the caller unable to hear the other person).
 */
import { getRingtoneSettings, CADENCE_PRESETS } from './ringtoneSettings'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let sources: OscillatorNode[] = []
let cycleTimer: number | null = null
let vibrateTimer: number | null = null
let mode: 'incoming' | 'outgoing' | null = null
let nativeRinging = false

type NativeRingBridge = { startRingtone?: () => void; stopRingtone?: () => void; stopIncomingAlert?: () => void }
const nativeBridge = (): NativeRingBridge | undefined =>
  (window as unknown as { AbiaCallBridge?: NativeRingBridge }).AbiaCallBridge

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function newGain(ac: AudioContext): GainNode {
  const g = ac.createGain()
  g.gain.value = 0
  g.connect(ac.destination)
  return g
}

/** Ringback: steady two-tone beep. */
function playRingback(volume: number) {
  const ac = ensureCtx()
  if (!ac) return
  stopTone()
  masterGain = newGain(ac)
  for (const f of [440, 480]) {
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.connect(masterGain)
    o.start()
    sources.push(o)
  }
  const t = ac.currentTime
  masterGain.gain.setValueAtTime(0, t)
  masterGain.gain.linearRampToValueAtTime(volume, t + 0.08)
}

/** Incoming ring: a bright four-note phrase played twice (about 1.8 s). */
function playRingPhrase(volume: number) {
  const ac = ensureCtx()
  if (!ac) return
  stopTone()
  const master = newGain(ac)
  master.gain.value = volume
  masterGain = master
  const notes = [659.25, 830.61, 987.77, 830.61] // E5 G#5 B5 G#5
  const step = 0.2
  const start = ac.currentTime + 0.02
  for (let rep = 0; rep < 2; rep++) {
    notes.forEach((freq, i) => {
      const at = start + rep * (notes.length * step + 0.15) + i * step
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'triangle'
      o.frequency.value = freq
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(1, at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, at + step * 0.95)
      o.connect(g)
      g.connect(master)
      o.start(at)
      o.stop(at + step)
      sources.push(o)
    })
  }
}

function stopTone() {
  for (const o of sources) {
    try { o.stop() } catch { /* already stopped */ }
    try { o.disconnect() } catch { /* ignore */ }
  }
  sources = []
  try { masterGain?.disconnect() } catch { /* ignore */ }
  masterGain = null
}

/** Release the phone's sound output entirely. */
function closeCtx() {
  const c = ctx
  ctx = null
  if (c) void c.close().catch(() => undefined)
}

export function startRingtone(direction: 'incoming' | 'outgoing') {
  if (mode === direction) return
  stopRingtone()
  mode = direction

  const settings = getRingtoneSettings()
  const preset = CADENCE_PRESETS[settings.cadence]

  if (direction === 'incoming') {
    // The call screen is showing in the app now: the system call alert that
    // brought the member here can stop (the app rings from here on).
    try { nativeBridge()?.stopIncomingAlert?.() } catch { /* ignore */ }
  }

  if (direction === 'incoming' && settings.ringEnabled) {
    const bridge = nativeBridge()
    if (typeof bridge?.startRingtone === 'function') {
      // The phone's own ringtone; it also vibrates by the phone's settings.
      try {
        bridge.startRingtone()
        nativeRinging = true
        return
      } catch {
        // fall back to the in-app melody below
      }
    }
  }

  if (settings.ringEnabled) {
    const volume = direction === 'incoming' ? Math.max(settings.volume, 0.3) : Math.min(settings.volume, 0.14)
    const ringMs = direction === 'incoming' ? 1900 : preset.onMs
    const pauseMs = direction === 'incoming' ? Math.min(preset.offMs, 1500) : preset.offMs
    const cycle = () => {
      if (direction === 'incoming') playRingPhrase(volume)
      else playRingback(volume)
      cycleTimer = window.setTimeout(() => {
        stopTone()
        cycleTimer = window.setTimeout(cycle, pauseMs)
      }, ringMs)
    }
    cycle()
  }

  if (direction === 'incoming' && settings.vibrateEnabled && 'vibrate' in navigator) {
    const pattern = [600, 400, 600, 400, 600]
    const tick = () => {
      try { navigator.vibrate(pattern) } catch { /* ignore */ }
      vibrateTimer = window.setTimeout(tick, 3400)
    }
    tick()
  }
}

export function stopRingtone() {
  mode = null
  if (cycleTimer) { window.clearTimeout(cycleTimer); cycleTimer = null }
  if (vibrateTimer) { window.clearTimeout(vibrateTimer); vibrateTimer = null }
  if (nativeRinging) {
    nativeRinging = false
    try { nativeBridge()?.stopRingtone?.() } catch { /* ignore */ }
  }
  stopTone()
  closeCtx()
  try { navigator.vibrate?.(0) } catch { /* ignore */ }
}
