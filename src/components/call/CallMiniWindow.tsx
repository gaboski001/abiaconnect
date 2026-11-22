import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Maximize2, Mic, MicOff, PhoneOff } from 'lucide-react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { callManager, type CallState } from '@/lib/webrtcCall'
import { clampMini, formatCallTime, snapMini, startMini, type MiniBox, type MiniSpot } from '@/lib/callMini'
import { cn } from '@/lib/utils'

/** Movement (px) before a press counts as a drag rather than a tap. */
const DRAG_START = 8

/** The phone's status bar and gesture bar heights (0 in a browser). */
function safeInsets() {
  if (typeof document === 'undefined') return { safeTop: 0, safeBottom: 0 }
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const css = getComputedStyle(probe)
  const result = {
    safeTop: Number.parseFloat(css.paddingTop) || 0,
    safeBottom: Number.parseFloat(css.paddingBottom) || 0,
  }
  probe.remove()
  return result
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight, ...safeInsets() }
}

/**
 * The call, shrunk to a small window that floats over the app (like WhatsApp),
 * so the member can read and type messages while still talking. Tap it to go
 * back to the full call screen; drag it anywhere.
 */
export function CallMiniWindow({ state, onOpen }: { state: CallState; onOpen: () => void }) {
  const isVideoTile = state.video && state.status === 'connected' && state.remoteCameraOn
  const box: MiniBox = isVideoTile ? { width: 116, height: 176 } : { width: 228, height: 64 }

  const [spot, setSpot] = useState<MiniSpot>(() => startMini(box, viewport()))
  const [dragging, setDragging] = useState(false)
  const [now, setNow] = useState(Date.now())
  const drag = useRef<{ x: number; y: number; start: MiniSpot; moved: boolean } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Keep it on screen when the size changes (video <-> voice, keyboard, rotate).
  useEffect(() => {
    const fit = () => setSpot((s) => clampMini(s, box, viewport()))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [box.width, box.height]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.status !== 'connected') return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [state.status])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const stream = callManager.getRemoteStream()
    if (el.srcObject !== stream) el.srcObject = stream
    if (stream) el.play().catch(() => undefined)
  }, [isVideoTile, state.mediaVersion])

  const connected = state.status === 'connected'
  const label = connected
    ? state.reconnecting
      ? 'Reconnecting…'
      : formatCallTime(state.startedAt ? now - state.startedAt : 0)
    : state.status === 'ended'
      ? state.error || 'Call ended'
      : state.remoteRinging
        ? 'Ringing…'
        : state.status === 'connecting'
          ? 'Connecting…'
          : 'Calling…'

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, start: spot, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG_START) return
    if (!d.moved) setDragging(true)
    d.moved = true
    setSpot(clampMini({ left: d.start.left + dx, top: d.start.top + dy }, box, viewport()))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (d.moved) setSpot((s) => snapMini(s, box, viewport()))
    else onOpen()
  }

  // Buttons inside must not start a drag or open the call.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  const peer = state.peer!

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Call with ${peer.name}. Tap to go back to the call`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen()
      }}
      style={{ left: spot.left, top: spot.top, width: box.width, height: box.height }}
      // Above pages and pop-ups, below the full call screen (z-100).
      className={cn(
        'fixed z-[95] touch-none select-none overflow-hidden text-white shadow-2xl ring-1 ring-white/15',
        isVideoTile ? 'rounded-2xl bg-black' : 'rounded-full bg-emerald-600',
        dragging ? 'scale-105 cursor-grabbing' : 'cursor-pointer transition-[left,top] duration-200',
      )}
    >
      {isVideoTile ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-2 pt-1.5 pb-4">
            <span className="text-[11px] font-semibold tabular-nums drop-shadow">{label}</span>
            <Maximize2 className="size-3.5 opacity-80" />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent pb-2 pt-5">
            <MiniButton label={state.muted ? 'Unmute' : 'Mute'} onPointerDown={stop} onClick={() => callManager.toggleMute()}>
              {state.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </MiniButton>
            <MiniButton label="End call" danger onPointerDown={stop} onClick={() => void callManager.endCall()}>
              <PhoneOff className="size-4" />
            </MiniButton>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center gap-2.5 pl-2 pr-2">
          <UserAvatar avatarUrl={peer.avatarUrl} displayName={peer.name} size="sm" className="h-11 w-11 shrink-0 border border-white/30" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold">{peer.name}</p>
            <p className="truncate text-[12px] tabular-nums text-white/85">{label}</p>
          </div>
          <MiniButton label={state.muted ? 'Unmute' : 'Mute'} onPointerDown={stop} onClick={() => callManager.toggleMute()}>
            {state.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </MiniButton>
          <MiniButton label="End call" danger onPointerDown={stop} onClick={() => void callManager.endCall()}>
            <PhoneOff className="size-4" />
          </MiniButton>
        </div>
      )}
    </div>
  )
}

function MiniButton({
  label,
  danger,
  onClick,
  onPointerDown,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full active:scale-95',
        danger ? 'bg-rose-500' : 'bg-white/20',
      )}
    >
      {children}
    </button>
  )
}
