import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { callManager, type CallQuality, type CallState } from '@/lib/webrtcCall'
import { startRingtone, stopRingtone } from '@/lib/ringtone'
import { cn } from '@/lib/utils'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'
import { CallDiagnosticsPanel } from './CallDiagnosticsPanel'

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const QUALITY_META: Record<CallQuality, { label: string; className: string; Icon: typeof Signal }> = {
  excellent: { label: 'Excellent', className: 'text-emerald-300', Icon: SignalHigh },
  good: { label: 'Good', className: 'text-emerald-300', Icon: SignalHigh },
  fair: { label: 'Fair', className: 'text-yellow-300', Icon: SignalMedium },
  poor: { label: 'Poor', className: 'text-rose-300', Icon: SignalLow },
  unknown: { label: 'Measuring…', className: 'text-slate-400', Icon: Signal },
}

export function CallOverlay({ state }: { state: CallState }) {
  const [now, setNow] = useState(Date.now())
  const [showTimeline, setShowTimeline] = useState(false)
  const [showDiag, setShowDiag] = useState(false)

  useEffect(() => {
    if (state.status !== 'connected') return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [state.status])

  // Professional ringtone/ringback while ringing or calling.
  // Caller only hears ringback once the callee's device has actually started
  // ringing (remoteRinging), matching real phone behaviour.
  useEffect(() => {
    if (state.status === 'ringing' && state.direction === 'incoming') {
      startRingtone('incoming')
    } else if (
      state.status === 'calling' &&
      state.direction === 'outgoing' &&
      state.remoteRinging
    ) {
      startRingtone('outgoing')
    } else {
      stopRingtone()
    }
    return () => stopRingtone()
  }, [state.status, state.direction, state.remoteRinging])

  const peer = state.peer!
  const elapsed = state.startedAt ? now - state.startedAt : 0

  const statusLabel =
    state.status === 'calling'
      ? state.remoteRinging
        ? 'Ringing…'
        : 'Calling…'
      : state.status === 'ringing'
        ? 'Incoming voice call'
        : state.status === 'connecting'
          ? 'Connecting…'
          : state.status === 'connected'
            ? fmt(elapsed)
            : state.status === 'ended'
              ? state.error || 'Call ended'
              : ''

  const qualityMeta = QUALITY_META[state.quality]
  const callMeta = useMemo(() => {
    const { rttMs, jitterMs, packetLossPct, bitrateKbps } = state.stats
    return [
      rttMs != null ? `RTT ${rttMs}ms` : null,
      jitterMs != null ? `Jitter ${jitterMs}ms` : null,
      packetLossPct != null ? `Loss ${packetLossPct}%` : null,
      bitrateKbps != null ? `${bitrateKbps}kbps` : null,
    ].filter(Boolean)
  }, [state.stats])

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[rgba(4,9,16,0.95)] px-5 py-8 text-white backdrop-blur-2xl animate-in fade-in">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at top, rgba(28,169,217,0.22), transparent 30%), radial-gradient(circle at 80% 0%, rgba(248,195,1,0.18), transparent 22%), linear-gradient(180deg, rgba(4,9,16,0.94) 0%, rgba(6,12,22,1) 100%)' }} />
      <div className="absolute -right-12 top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.18)' }} />
      <div className="absolute -left-16 bottom-20 h-52 w-52 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.18)' }} />

      <div className="relative mx-auto flex h-full max-w-md flex-col justify-between">
        <div className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200/80" style={{ background: GOLD_GRADIENT_SOFT }}>
            <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
            Premium voice call
          </div>

          <div className="mx-auto mt-4 w-fit rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl" style={{ boxShadow: PREMIUM_SHADOW }}>
            <div className={cn('rounded-full p-1.5', (state.status === 'calling' || state.status === 'ringing') && 'animate-pulse ring-4 ring-[#F8C301]/35')}>
              <UserAvatar avatarUrl={peer.avatarUrl} displayName={peer.name} size="xl" className="h-28 w-28 border border-white/10" />
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black tracking-tight">{peer.name}</h2>
            <p className="mt-2 text-sm text-slate-300/72">{statusLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
              <p className="mt-2 text-sm font-bold text-white">{state.status === 'calling' ? (state.remoteRinging ? 'Ringing their phone' : 'Reaching out…') : state.status === 'ringing' ? 'Awaiting response' : state.status === 'connected' ? 'Live' : state.status}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Security</p>
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-emerald-300"><ShieldCheck className="size-4" /> Encrypted</p>
            </div>
          </div>

          {state.status === 'connected' ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 text-left">
              <div className={cn('inline-flex items-center gap-2 text-sm font-semibold', qualityMeta.className)}>
                <qualityMeta.Icon className="h-4 w-4" />
                {qualityMeta.label}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300/76">
                {callMeta.length > 0 ? callMeta.map((line) => <span key={line} className="rounded-full border border-white/10 px-3 py-1">{line}</span>) : <span className="rounded-full border border-white/10 px-3 py-1">Listening for network metrics</span>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-300/76">
                <button type="button" onClick={() => setShowTimeline((v) => !v)} className="inline-flex items-center gap-2 hover:text-white">
                  <Activity className="h-3.5 w-3.5" />
                  {showTimeline ? 'Hide' : 'Show'} quality timeline
                </button>
                <button type="button" onClick={() => setShowDiag((v) => !v)} className="inline-flex items-center gap-2 hover:text-white">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {showDiag ? 'Hide' : 'Show'} diagnostics
                </button>
              </div>

              {showTimeline ? (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-[11px] font-mono">
                  {state.timeline.length === 0 ? (
                    <p className="text-slate-400">No events yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {state.timeline.map((ev, i) => {
                        const t = new Date(ev.at)
                        const meta = QUALITY_META[ev.quality]
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-slate-500">{t.toLocaleTimeString([], { hour12: false })}</span>
                            <span className={meta.className}>{meta.label}</span>
                            {ev.note ? <span className="text-slate-400">— {ev.note}</span> : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              {showDiag ? <div className="mt-3"><CallDiagnosticsPanel /></div> : null}
            </div>
          ) : showDiag ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4">
              <CallDiagnosticsPanel />
            </div>
          ) : null}

          {state.status !== 'connected' && state.status !== 'ended' ? (
            <button
              type="button"
              onClick={() => setShowDiag((v) => !v)}
              className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-slate-300/80 hover:text-white"
            >
              <Stethoscope className="h-3.5 w-3.5" />
              {showDiag ? 'Hide' : 'Show'} diagnostics
            </button>
          ) : null}

          {state.status === 'connected' && state.degraded ? (
            <div className="rounded-[1.5rem] border border-rose-400/30 bg-rose-400/10 p-4 text-left text-sm text-rose-100">
              <p>
                Connection quality has dropped.
                {state.reconnectAttempts > 0 ? ` Retry ${state.reconnectAttempts}/${state.maxReconnectAttempts}.` : ''}
              </p>
              <Button type="button" size="sm" variant="destructive" className="mt-3 rounded-xl" disabled={state.reconnecting} onClick={() => callManager.reconnect()}>
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', state.reconnecting && 'animate-spin')} />
                {state.reconnecting ? 'Reconnecting…' : 'Reconnect now'}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="mx-auto flex max-w-sm items-center justify-center gap-5 rounded-[2rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl" style={{ boxShadow: PREMIUM_SHADOW }}>
            {state.status === 'connected' ? (
              <Button type="button" size="icon" variant={state.muted ? 'default' : 'secondary'} className="h-14 w-14 rounded-full border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]" onClick={() => callManager.toggleMute()} aria-label={state.muted ? 'Unmute' : 'Mute'}>
                {state.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
            ) : null}

            {state.status === 'ringing' ? (
              <>
                <Button type="button" size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={() => callManager.reject()} aria-label="Decline">
                  <PhoneOff className="h-7 w-7" />
                </Button>
                <Button type="button" size="icon" className="h-16 w-16 rounded-full bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => callManager.accept()} aria-label="Accept">
                  <Phone className="h-7 w-7" />
                </Button>
              </>
            ) : state.status !== 'ended' ? (
              <Button type="button" size="icon" variant="destructive" className="h-16 w-16 rounded-full" onClick={() => callManager.endCall()} aria-label="End call">
                <PhoneOff className="h-7 w-7" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
