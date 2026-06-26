import { useEffect, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, SignalHigh, SignalMedium, SignalLow, Signal, RefreshCw } from 'lucide-react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { callManager, type CallState, type CallQuality } from '@/lib/webrtcCall'
import { cn } from '@/lib/utils'

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const QUALITY_META: Record<CallQuality, { label: string; className: string; Icon: typeof Signal }> = {
  excellent: { label: 'Excellent', className: 'text-green-500', Icon: SignalHigh },
  good: { label: 'Good', className: 'text-green-500', Icon: SignalHigh },
  fair: { label: 'Fair', className: 'text-yellow-500', Icon: SignalMedium },
  poor: { label: 'Poor', className: 'text-red-500', Icon: SignalLow },
  unknown: { label: 'Measuring…', className: 'text-muted-foreground', Icon: Signal },
}



export function CallOverlay({ state }: { state: CallState }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (state.status !== 'connected') return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [state.status])

  const peer = state.peer!
  const elapsed = state.startedAt ? now - state.startedAt : 0

  const statusLabel =
    state.status === 'calling'
      ? 'Calling…'
      : state.status === 'ringing'
        ? 'Incoming voice call'
        : state.status === 'connecting'
          ? 'Connecting…'
          : state.status === 'connected'
            ? fmt(elapsed)
            : state.status === 'ended'
              ? state.error || 'Call ended'
              : ''

  const isRinging = state.status === 'ringing'

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-between py-10 px-6 animate-in fade-in">
      <div className="flex flex-col items-center gap-4 mt-10">
        <div
          className={cn(
            'rounded-full p-1',
            (state.status === 'calling' || state.status === 'ringing') &&
              'ring-4 ring-primary/40 animate-pulse',
          )}
        >
          <UserAvatar
            avatarUrl={peer.avatarUrl}
            displayName={peer.name}
            size="xl"
          />
        </div>
        <h2 className="text-xl font-semibold">{peer.name}</h2>
        <p className="text-sm text-muted-foreground tabular-nums">{statusLabel}</p>
        {state.status === 'connected' && (() => {
          const meta = QUALITY_META[state.quality]
          const { Icon } = meta
          const { rttMs, jitterMs, packetLossPct, bitrateKbps } = state.stats
          return (
            <div
              className={cn('flex items-center gap-1.5 text-xs', meta.className)}
              title={[
                rttMs != null ? `RTT ${rttMs}ms` : null,
                jitterMs != null ? `jitter ${jitterMs}ms` : null,
                packetLossPct != null ? `loss ${packetLossPct}%` : null,
                bitrateKbps != null ? `${bitrateKbps}kbps` : null,
              ]
                .filter(Boolean)
                .join(' • ')}
              aria-label={`Call quality: ${meta.label}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{meta.label}</span>
            </div>
          )
        })()}
      </div>


      <div className="flex items-center gap-6">
        {state.status === 'connected' && (
          <Button
            type="button"
            size="icon"
            variant={state.muted ? 'default' : 'secondary'}
            className="h-14 w-14 rounded-full"
            onClick={() => callManager.toggleMute()}
            aria-label={state.muted ? 'Unmute' : 'Mute'}
          >
            {state.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
        )}

        {isRinging ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() => callManager.reject()}
              aria-label="Decline"
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => callManager.accept()}
              aria-label="Accept"
            >
              <Phone className="h-7 w-7" />
            </Button>
          </>
        ) : (
          state.status !== 'ended' && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() => callManager.endCall()}
              aria-label="End call"
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
          )
        )}
      </div>
    </div>
  )
}
