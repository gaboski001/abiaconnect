import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { callManager, type CallState } from '@/lib/webrtcCall'
import { CallOverlay } from './CallOverlay'

// Native Android bridge injected by MainActivity.CallJsBridge.
// Safe to reference on web (undefined) or iOS (undefined) — calls are no-ops.
declare global {
  interface Window {
    AbiaCallBridge?: {
      startCall: (callerName: string, callId: string) => void
      endCall: () => void
    }
  }
}

export function CallProvider() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [state, setState] = useState<CallState>({
    status: 'idle',
    callId: null,
    direction: null,
    peer: null,
    muted: false,
    startedAt: null,
    error: null,
    quality: 'unknown',
    stats: { rttMs: null, jitterMs: null, packetLossPct: null, bitrateKbps: null },
    degraded: false,
    reconnecting: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 3,
    timeline: [],
  })


  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Callback ref: fires the instant React attaches (or detaches) the <audio>
  // element, so the call manager always has a live sink for remote tracks —
  // even when the element mounts after auth hydrates and the ref-effect below
  // would otherwise miss it.
  const setAudioNode = (node: HTMLAudioElement | null) => {
    audioRef.current = node
    callManager.setRemoteAudioElement(node)
  }

  useEffect(() => {
    if (!userId) return
    callManager.init({
      id: userId,
      name:
        (user?.user_metadata?.display_name as string | undefined) ||
        (user?.user_metadata?.username as string | undefined) ||
        user?.email ||
        'You',
      avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
    })
    return () => {
      callManager.shutdown()
    }
    // Keep this keyed only by user id so profile fetches/rerenders do not tear
    // down the native call signaling channel while the user is navigating chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    const unsub = callManager.subscribe(setState)
    return () => {
      unsub()
    }
  }, [])

  // Re-bind the audio sink whenever userId flips (element mounts/unmounts
  // with the early-return guard below). The callback ref above handles the
  // first attach; this covers sign-out/sign-in cycles.
  useEffect(() => {
    callManager.setRemoteAudioElement(audioRef.current)
  }, [userId])

  // ── Native Android foreground-service sync ──────────────────────────────
  // Start the phoneCall foreground service once the peer connection is
  // actually connected (works for both incoming and outgoing calls); stop
  // it as soon as the call goes back to ended/idle. This keeps the process
  // — and WebRTC session — alive when the user backgrounds the app.
  const fgActiveRef = useRef(false)
  useEffect(() => {
    const bridge = window.AbiaCallBridge
    if (!bridge) return

    if (state.status === 'connected' && !fgActiveRef.current) {
      fgActiveRef.current = true
      bridge.startCall(state.peer?.name || 'AbiaConnect call', state.callId || '')
    } else if (
      fgActiveRef.current &&
      (state.status === 'idle' || state.status === 'ended')
    ) {
      fgActiveRef.current = false
      bridge.endCall()
    }
  }, [state.status, state.callId, state.peer?.name])

  // ── Notification action listeners ───────────────────────────────────────
  // MainActivity dispatches these window events when the user taps Answer,
  // Decline, or Hang-up on the system notification. Route each to the
  // matching callManager method so the WebRTC session stays in sync with
  // what the notification UI just did.
  // Keep a ref of the latest status so the stable event handlers below
  // can read it without re-subscribing on every state change.
  const statusRef = useRef(state.status)
  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  useEffect(() => {
    const onAnswer = () => {
      // Only accept if we actually have a ringing invite. If FCM arrived
      // before the realtime `invite` event, this is a no-op and the invite
      // handler will still surface the incoming-call UI on arrival.
      if (statusRef.current === 'ringing') {
        void callManager.accept()
      }
    }
    const onDecline = () => {
      if (statusRef.current === 'ringing') {
        callManager.reject()
      }
    }
    const onHangup = () => {
      const s = statusRef.current
      if (s === 'connected' || s === 'connecting' || s === 'calling') {
        void callManager.endCall(true)
      }
    }

    window.addEventListener('abiaconnect-native-call-answer', onAnswer)
    window.addEventListener('abiaconnect-native-call-decline', onDecline)
    window.addEventListener('abiaconnect-native-call-hangup', onHangup)
    return () => {
      window.removeEventListener('abiaconnect-native-call-answer', onAnswer)
      window.removeEventListener('abiaconnect-native-call-decline', onDecline)
      window.removeEventListener('abiaconnect-native-call-hangup', onHangup)
    }
  }, [])

  if (!userId) return null

  return (
    <>
      <audio ref={setAudioNode} autoPlay playsInline />
      {state.status !== 'idle' && state.peer && <CallOverlay state={state} />}
    </>
  )
}
