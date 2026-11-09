import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Info,
  Lock,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCw,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { callManager, canSwitchAudioRoute, type CallQuality, type CallState } from '@/lib/webrtcCall'
import { startRingtone, stopRingtone } from '@/lib/ringtone'
import { cn } from '@/lib/utils'
import { CallDiagnosticsPanel } from './CallDiagnosticsPanel'

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

const QUALITY_HINT: Partial<Record<CallQuality, string>> = {
  fair: 'Unstable connection',
  poor: 'Weak connection',
}

/** Round call control with a label underneath (easy to understand at a glance). */
function Control({
  label,
  onClick,
  active,
  danger,
  accept,
  big,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  accept?: boolean
  big?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex w-[68px] flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'flex items-center justify-center rounded-full transition-transform active:scale-95',
          big ? 'size-[68px]' : 'size-14',
          danger && 'bg-rose-500 text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.8)]',
          accept && 'bg-emerald-500 text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.8)]',
          !danger && !accept && (active ? 'bg-white text-slate-900' : 'bg-white/15 text-white backdrop-blur-md'),
        )}
      >
        {children}
      </button>
      <span className="text-center text-[12px] font-medium leading-tight text-white/85">{label}</span>
    </div>
  )
}

export function CallOverlay({ state }: { state: CallState }) {
  const [now, setNow] = useState(Date.now())
  const [showDetails, setShowDetails] = useState(false)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakerSwitchable = canSwitchAudioRoute()

  useEffect(() => {
    if (state.status !== 'connected') return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [state.status])

  // Ringtone while ringing; ringback for the caller once the other phone rings.
  useEffect(() => {
    if (state.status === 'ringing' && state.direction === 'incoming') {
      startRingtone('incoming')
    } else if (state.status === 'calling' && state.direction === 'outgoing' && state.remoteRinging) {
      startRingtone('outgoing')
    } else {
      stopRingtone()
    }
    return () => stopRingtone()
  }, [state.status, state.direction, state.remoteRinging])

  // Bind the media streams to the video views whenever they change.
  useEffect(() => {
    const remote = remoteVideoRef.current
    if (remote) {
      const stream = callManager.getRemoteStream()
      if (remote.srcObject !== stream) remote.srcObject = stream
      if (stream) remote.play().catch(() => undefined)
    }
    const local = localVideoRef.current
    if (local) {
      const stream = callManager.getLocalStream()
      if (local.srcObject !== stream) local.srcObject = stream
      if (stream) local.play().catch(() => undefined)
    }
  }, [state.mediaVersion, state.status, state.cameraOn, state.remoteCameraOn])

  const peer = state.peer!
  const isVideo = state.video
  const connected = state.status === 'connected'
  const showRemoteVideo = isVideo && connected && state.remoteCameraOn
  const showLocalFull = isVideo && state.cameraOn && !connected && state.status !== 'ended'
  const showLocalPip = isVideo && state.cameraOn && connected
  const elapsed = state.startedAt ? now - state.startedAt : 0
  const kind = isVideo ? 'video call' : 'voice call'

  const statusLabel =
    state.status === 'calling'
      ? state.remoteRinging ? 'Ringing…' : 'Calling…'
      : state.status === 'ringing'
        ? `Incoming ${kind}`
        : state.status === 'connecting'
          ? 'Connecting…'
          : connected
            ? state.reconnecting ? 'Reconnecting…' : fmt(elapsed)
            : state.status === 'ended'
              ? state.error || 'Call ended'
              : ''

  const qualityHint = connected && !state.reconnecting ? QUALITY_HINT[state.quality] : undefined
  const inCall = state.status === 'calling' || state.status === 'connecting' || connected

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#070D17] text-white animate-in fade-in"
      role="dialog"
      aria-label={`${kind} with ${peer.name}`}
    >
      {/* Background: remote video, own camera preview, or a calm brand gradient */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        className={cn('absolute inset-0 h-full w-full object-cover md:object-contain', !showRemoteVideo && 'hidden')}
      />
      {showLocalFull ? (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={cn('absolute inset-0 h-full w-full object-cover', state.facing === 'user' && '-scale-x-100')}
        />
      ) : null}
      {!showRemoteVideo && !showLocalFull ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 70% at 50% 0%, rgba(28,169,217,0.20) 0%, transparent 55%), radial-gradient(90% 60% at 50% 110%, rgba(248,195,1,0.12) 0%, transparent 60%), #070D17',
          }}
        />
      ) : null}
      {/* Legibility scrims over video */}
      {showRemoteVideo || showLocalFull ? (
        <>
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/80 to-transparent" />
        </>
      ) : null}

      <div
        className="relative flex h-full flex-col"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 1.25rem)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/70">
            <Lock className="size-3.5" />
            End-to-end encrypted
          </span>
          {inCall ? (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              aria-label="Call details"
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 active:bg-white/20"
            >
              <Info className="size-[18px]" />
            </button>
          ) : null}
        </div>

        {/* Identity */}
        {showRemoteVideo ? (
          <div className="mt-3 px-5">
            <h2 className="text-xl font-bold drop-shadow">{peer.name}</h2>
            <p className="text-sm text-white/80 drop-shadow">{statusLabel}</p>
          </div>
        ) : (
          <div className="mt-[12vh] flex flex-col items-center px-6 text-center">
            <div className="relative">
              {(state.status === 'calling' || state.status === 'ringing') && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/10 [animation-duration:2s]" />
                  <span className="absolute -inset-3 rounded-full border border-white/10" />
                </>
              )}
              <UserAvatar
                avatarUrl={peer.avatarUrl}
                displayName={peer.name}
                size="xl"
                className="relative h-28 w-28 border-2 border-white/15"
              />
            </div>
            <h2 className="mt-6 text-[28px] font-bold leading-tight tracking-tight drop-shadow">{peer.name}</h2>
            <p className={cn('mt-1.5 text-base drop-shadow', state.status === 'ended' && state.error ? 'text-rose-200' : 'text-white/75')}>
              {statusLabel}
            </p>
            {isVideo && connected && !state.remoteCameraOn ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/60">
                <VideoOff className="size-4" /> Camera is off
              </p>
            ) : null}
          </div>
        )}

        {/* Status pills */}
        <div className="mt-4 flex flex-col items-center gap-2 px-6">
          {state.notice ? (
            <span className="rounded-full bg-black/40 px-3 py-1.5 text-[13px] text-white/90 backdrop-blur">{state.notice}</span>
          ) : null}
          {qualityHint ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1.5 text-[13px] text-amber-200 backdrop-blur">
              {qualityHint}
            </span>
          ) : null}
          {connected && state.degraded ? (
            <button
              type="button"
              disabled={state.reconnecting}
              onClick={() => callManager.reconnect()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur disabled:opacity-60"
            >
              <RefreshCw className={cn('size-3.5', state.reconnecting && 'animate-spin')} />
              {state.reconnecting ? 'Reconnecting…' : 'Reconnect'}
            </button>
          ) : null}
        </div>

        {/* Self view during a connected video call */}
        {showLocalPip ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'absolute right-4 top-[calc(max(env(safe-area-inset-top),1.25rem)+3.5rem)] h-40 w-28 rounded-2xl border border-white/20 object-cover shadow-2xl md:right-6 md:h-44 md:w-72',
              state.facing === 'user' && '-scale-x-100',
            )}
          />
        ) : null}

        <div className="flex-1" />

        {/* Controls */}
        {state.status === 'ringing' ? (
          <div className="px-8 md:mx-auto md:w-full md:max-w-sm">
            <div className="flex items-start justify-between">
              <Control label="Decline" danger big onClick={() => callManager.reject()}>
                <PhoneOff className="size-7" />
              </Control>
              <Control label="Accept" accept big onClick={() => void callManager.accept()}>
                {isVideo ? <Video className="size-7" /> : <Phone className="size-7" />}
              </Control>
            </div>
            {isVideo ? (
              <button
                type="button"
                onClick={() => void callManager.accept({ video: false })}
                className="mx-auto mt-6 block text-sm font-semibold text-white/80 underline-offset-4 active:underline"
              >
                Answer with voice only
              </button>
            ) : null}
          </div>
        ) : inCall ? (
          <div className="mx-4 rounded-[28px] bg-black/30 px-3 pb-4 pt-5 backdrop-blur-xl md:mx-auto md:w-full md:max-w-md">
            <div className="flex items-start justify-around">
              {speakerSwitchable ? (
                <Control label="Speaker" active={state.speakerOn} onClick={() => callManager.setSpeaker(!state.speakerOn)}>
                  <Volume2 className="size-6" />
                </Control>
              ) : null}
              {isVideo ? (
                <Control label={state.cameraOn ? 'Camera' : 'Camera off'} active={!state.cameraOn} onClick={() => callManager.toggleCamera()}>
                  {state.cameraOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
                </Control>
              ) : null}
              {isVideo && state.cameraOn ? (
                <Control label="Flip" onClick={() => void callManager.switchCamera()}>
                  <SwitchCamera className="size-6" />
                </Control>
              ) : null}
              <Control label={state.muted ? 'Unmute' : 'Mute'} active={state.muted} onClick={() => callManager.toggleMute()}>
                {state.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </Control>
              <Control label="End" danger onClick={() => void callManager.endCall()}>
                <PhoneOff className="size-6" />
              </Control>
            </div>
          </div>
        ) : null}
      </div>

      {/* Call details (technical info, for troubleshooting) */}
      {showDetails ? (
        <div className="absolute inset-0 z-10 flex items-end bg-black/50" onClick={() => setShowDetails(false)}>
          <div
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-[28px] bg-[#0E1626] p-5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Call details</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowDetails(false)}
                className="flex size-9 items-center justify-center rounded-full bg-white/10"
              >
                <X className="size-[18px]" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Connection', state.quality === 'unknown' ? 'Measuring…' : state.quality],
                ['Delay', state.stats.rttMs != null ? `${state.stats.rttMs} ms` : '—'],
                ['Jitter', state.stats.jitterMs != null ? `${state.stats.jitterMs} ms` : '—'],
                ['Packet loss', state.stats.packetLossPct != null ? `${state.stats.packetLossPct}%` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/5 p-3">
                  <dt className="text-[12px] text-white/50">{k}</dt>
                  <dd className="mt-1 font-semibold capitalize">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <CallDiagnosticsPanel />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
