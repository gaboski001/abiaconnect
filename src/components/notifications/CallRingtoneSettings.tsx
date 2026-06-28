import { useEffect, useState } from 'react'
import { Bell, BellOff, PhoneIncoming, Vibrate, Volume2, Play, Square } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

import {
  CADENCE_PRESETS,
  getRingtoneSettings,
  loadRingtoneSettingsFromProfile,
  setRingtoneSettings,
  type RingCadence,
  type RingtoneSettings,
} from '@/lib/ringtoneSettings'
import { startRingtone, stopRingtone } from '@/lib/ringtone'
import { cn } from '@/lib/utils'

export function CallRingtoneSettings() {
  const [settings, setSettings] = useState<RingtoneSettings>(() => getRingtoneSettings())
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<RingtoneSettings>).detail
      if (detail) setSettings(detail)
    }
    window.addEventListener('abia:ringtone-settings', onChange as EventListener)
    return () => window.removeEventListener('abia:ringtone-settings', onChange as EventListener)
  }, [])

  const update = (patch: Partial<RingtoneSettings>) => setSettings(setRingtoneSettings(patch))

  const stopTest = () => {
    stopRingtone()
    setTesting(false)
  }

  const playTest = () => {
    stopRingtone()
    setTesting(true)
    startRingtone('incoming')
    window.setTimeout(stopTest, 6500)
  }

  useEffect(() => stopTest, [])

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-white">
          <PhoneIncoming className="size-4 text-emerald-300" />
          <h3 className="text-sm font-bold">Incoming call ringtone</h3>
        </div>
        <p className="mt-1 text-xs text-slate-300/70">
          Plays a professional dual-tone ring when someone calls. Uses your device volume.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          {settings.ringEnabled ? <Bell className="size-4 text-amber-300" /> : <BellOff className="size-4 text-slate-400" />}
          <div>
            <p className="text-sm font-semibold text-white">Ring sound</p>
            <p className="text-[11px] text-slate-300/70">Play tone for incoming and outgoing calls</p>
          </div>
        </div>
        <Switch checked={settings.ringEnabled} onCheckedChange={(v) => update({ ringEnabled: !!v })} />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          <Vibrate className={cn('size-4', settings.vibrateEnabled ? 'text-emerald-300' : 'text-slate-400')} />
          <div>
            <p className="text-sm font-semibold text-white">Vibration</p>
            <p className="text-[11px] text-slate-300/70">Vibrate on incoming calls (mobile only)</p>
          </div>
        </div>
        <Switch checked={settings.vibrateEnabled} onCheckedChange={(v) => update({ vibrateEnabled: !!v })} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">Ring cadence</p>
        <p className="text-[11px] text-slate-300/70">How long the tone rings and pauses between cycles.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(CADENCE_PRESETS) as RingCadence[]).map((key) => {
            const preset = CADENCE_PRESETS[key]
            const active = settings.cadence === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ cadence: key })}
                disabled={!settings.ringEnabled}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition disabled:opacity-50',
                  active
                    ? 'border-amber-400/60 bg-amber-400/10 text-white shadow-[0_0_0_1px_rgba(248,195,1,0.35)]'
                    : 'border-white/10 bg-white/[0.02] text-slate-200 hover:border-white/20',
                )}
              >
                <p className="text-sm font-bold">{preset.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-300/70">{preset.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-white">
          <Volume2 className="size-4 text-amber-300" />
          <p className="text-sm font-semibold">Ring volume</p>
          <span className="ml-auto text-xs text-slate-300/70">{Math.round(settings.volume * 100)}%</span>
        </div>
        <div className="mt-3">
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            disabled={!settings.ringEnabled}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            className="w-full accent-amber-400 disabled:opacity-50"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={testing ? stopTest : playTest}
      >
        {testing ? (<><Square className="mr-2 size-4" /> Stop test</>) : (<><Play className="mr-2 size-4" /> Test ringtone</>)}
      </Button>
    </div>
  )
}
