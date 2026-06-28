/**
 * Call ringtone & vibration preferences, persisted in localStorage.
 * Used by src/lib/ringtone.ts at ring start.
 */

export type RingCadence = 'classic' | 'short' | 'continuous'

export interface RingtoneSettings {
  ringEnabled: boolean
  vibrateEnabled: boolean
  cadence: RingCadence
  volume: number // 0..1
}

const KEY = 'abia:call-ringtone-settings'

export const CADENCE_PRESETS: Record<RingCadence, { onMs: number; offMs: number; label: string; description: string }> = {
  classic:    { onMs: 2000, offMs: 4000, label: 'Classic',    description: '2s ring · 4s pause (default phone cadence)' },
  short:      { onMs: 1000, offMs: 2000, label: 'Short',      description: '1s ring · 2s pause (faster alerts)' },
  continuous: { onMs: 4000, offMs: 1000, label: 'Continuous', description: '4s ring · 1s pause (hard to miss)' },
}

const DEFAULTS: RingtoneSettings = {
  ringEnabled: true,
  vibrateEnabled: true,
  cadence: 'classic',
  volume: 0.22,
}

export function getRingtoneSettings(): RingtoneSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setRingtoneSettings(patch: Partial<RingtoneSettings>) {
  const next = { ...getRingtoneSettings(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  try { window.dispatchEvent(new CustomEvent('abia:ringtone-settings', { detail: next })) } catch {}
  return next
}
