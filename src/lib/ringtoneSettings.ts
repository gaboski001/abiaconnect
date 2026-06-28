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
  // Fire-and-forget remote sync to the user's profile (if signed in).
  void syncRingtoneSettingsToProfile(next)
  return next
}

// ---------------------------------------------------------------------------
// Remote sync — keeps preferences aligned across the user's devices.
// ---------------------------------------------------------------------------
import { supabase } from '@/integrations/supabase/client'

function sanitize(raw: unknown): RingtoneSettings {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const cadence = obj.cadence as RingCadence
  return {
    ringEnabled: typeof obj.ringEnabled === 'boolean' ? obj.ringEnabled : DEFAULTS.ringEnabled,
    vibrateEnabled: typeof obj.vibrateEnabled === 'boolean' ? obj.vibrateEnabled : DEFAULTS.vibrateEnabled,
    cadence: (cadence === 'classic' || cadence === 'short' || cadence === 'continuous') ? cadence : DEFAULTS.cadence,
    volume: typeof obj.volume === 'number' ? Math.min(1, Math.max(0, obj.volume)) : DEFAULTS.volume,
  }
}

/** Load remote settings from the profile and merge into local cache. */
export async function loadRingtoneSettingsFromProfile(): Promise<RingtoneSettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('call_ringtone_settings')
      .eq('id', user.id)
      .maybeSingle()
    if (error || !data?.call_ringtone_settings) return null
    const remote = sanitize(data.call_ringtone_settings)
    try { localStorage.setItem(KEY, JSON.stringify(remote)) } catch {}
    try { window.dispatchEvent(new CustomEvent('abia:ringtone-settings', { detail: remote })) } catch {}
    return remote
  } catch {
    return null
  }
}

let saveTimer: number | null = null
async function syncRingtoneSettingsToProfile(next: RingtoneSettings) {
  if (typeof window === 'undefined') return
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase
        .from('profiles')
        .update({ call_ringtone_settings: next as any })
        .eq('id', user.id)
    } catch {
      // network failures are non-fatal — local cache still wins
    }
  }, 400)
}

