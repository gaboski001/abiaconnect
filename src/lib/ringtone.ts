/**
 * Professional call ringtone / ringback using WebAudio.
 * - Incoming: classic dual-tone phone ring (440Hz + 480Hz, 2s on / 4s off)
 * - Outgoing ringback: 440Hz + 480Hz, 2s on / 4s off (US ringback)
 * Falls back gracefully if WebAudio is blocked. Also vibrates on mobile.
 */

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let oscA: OscillatorNode | null = null
let oscB: OscillatorNode | null = null
let cycleTimer: number | null = null
let vibrateTimer: number | null = null
let mode: 'incoming' | 'outgoing' | null = null

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

function startTone(volume: number) {
  const ac = ensureCtx()
  if (!ac) return
  stopTone()
  masterGain = ac.createGain()
  masterGain.gain.value = 0
  masterGain.connect(ac.destination)

  oscA = ac.createOscillator()
  oscB = ac.createOscillator()
  oscA.type = 'sine'
  oscB.type = 'sine'
  oscA.frequency.value = 440
  oscB.frequency.value = 480
  oscA.connect(masterGain)
  oscB.connect(masterGain)
  oscA.start()
  oscB.start()

  // soft attack
  const t = ac.currentTime
  masterGain.gain.cancelScheduledValues(t)
  masterGain.gain.setValueAtTime(0, t)
  masterGain.gain.linearRampToValueAtTime(volume, t + 0.08)
}

function stopTone() {
  if (masterGain && ctx) {
    const t = ctx.currentTime
    try {
      masterGain.gain.cancelScheduledValues(t)
      masterGain.gain.linearRampToValueAtTime(0, t + 0.05)
    } catch {}
  }
  try { oscA?.stop() } catch {}
  try { oscB?.stop() } catch {}
  oscA = null
  oscB = null
  masterGain = null
}

import { getRingtoneSettings, CADENCE_PRESETS } from './ringtoneSettings'

export function startRingtone(direction: 'incoming' | 'outgoing') {
  if (mode === direction) return
  stopRingtone()
  mode = direction

  const settings = getRingtoneSettings()
  const preset = CADENCE_PRESETS[settings.cadence]
  const onMs = preset.onMs
  const offMs = preset.offMs
  // Outgoing ringback is always quieter; respects the same enabled flag.
  const baseVolume = direction === 'incoming' ? settings.volume : Math.min(settings.volume, 0.14)

  if (settings.ringEnabled) {
    const cycle = () => {
      startTone(baseVolume)
      cycleTimer = window.setTimeout(() => {
        stopTone()
        cycleTimer = window.setTimeout(cycle, offMs)
      }, onMs)
    }
    cycle()
  }

  if (direction === 'incoming' && settings.vibrateEnabled && 'vibrate' in navigator) {
    const pattern = [600, 400, 600, 400, 600]
    const tick = () => {
      try { navigator.vibrate(pattern) } catch {}
      vibrateTimer = window.setTimeout(tick, onMs + offMs - 500)
    }
    tick()
  }
}


export function stopRingtone() {
  mode = null
  if (cycleTimer) { window.clearTimeout(cycleTimer); cycleTimer = null }
  if (vibrateTimer) { window.clearTimeout(vibrateTimer); vibrateTimer = null }
  stopTone()
  try { navigator.vibrate?.(0) } catch {}
}
