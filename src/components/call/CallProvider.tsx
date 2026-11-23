import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { callManager, type CallState } from '@/lib/webrtcCall'
import { canMinimiseCall } from '@/lib/callMini'
import { CallMiniWindow } from './CallMiniWindow'
import { CallOverlay } from './CallOverlay'

// Native Android bridge injected by MainActivity.CallJsBridge.
// Safe to reference on web (undefined) or iOS (undefined) — calls are no-ops.
declare global {
  interface Window {
    AbiaCallBridge?: {
      startCall: (callerName: string, callId: string) => void
      endCall: () => void
      /**
       * App 1.1.3+: a video call is on, so leaving the app shrinks it to the
       * phone's floating window (picture-in-picture). Missing in older apps.
       */
      setVideoCall?: (active: boolean) => void
      /** App 1.1.4+: a call answered from the alert while the page was still loading ("" if none). */
      takePendingAnswer?: () => string
    }
  }
}

export function CallProvider() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [state, setState] = useState<CallState>(() => callManager.getState())
  // Call shrunk to the floating window so the member can use the app.
  const [minimized, setMinimized] = useState(false)
  // The phone shows the app in its own small floating window (Android PiP).
  const [pip, setPip] = useState(false)

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
      const name = state.peer?.name || 'AbiaConnect call'
      const callId = state.callId || ''
      const oldApp = typeof (bridge as { stopIncomingAlert?: unknown }).stopIncomingAlert !== 'function'
      if (oldApp && state.direction === 'incoming') {
        // App 1.1.3 and older: pressing Answer on the alert starts the "call in
        // progress" notice on the ringing channel, so the phone's ringtone keeps
        // playing after the call connects (and can drown out the other person).
        // Restarting the notice now that the phone is in call mode stops that
        // ringtone, and Android does not ring again during a call.
        bridge.endCall()
        window.setTimeout(() => {
          if (fgActiveRef.current) bridge.startCall(name, callId)
        }, 700)
      } else {
        bridge.startCall(name, callId)
      }
    } else if (
      fgActiveRef.current &&
      (state.status === 'idle' || state.status === 'ended')
    ) {
      fgActiveRef.current = false
      bridge.endCall()
    }
  }, [state.status, state.callId, state.peer?.name, state.direction])

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
    const onAnswer = (e: Event) => {
      const detail = (e as CustomEvent).detail as { callId?: string } | undefined
      const callId = detail?.callId ?? ''
      // Ringing already: accept immediately.
      if (statusRef.current === 'ringing') {
        void callManager.accept()
        return
      }
      // FCM Answer arrived before the realtime invite — queue the accept so
      // it fires the instant the invite lands, avoiding a second ring.
      if (callId) callManager.queuePendingAccept(callId)
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

    // The app was closed when Answer was pressed: the event above fired before
    // this page was listening, so collect the answer from the app now.
    try {
      const pending = window.AbiaCallBridge?.takePendingAnswer?.()
      if (pending) onAnswer(new CustomEvent('abiaconnect-native-call-answer', { detail: { callId: pending } }))
    } catch {
      // older app: nothing to collect
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

  // A new call (or a call coming in) always opens full screen.
  useEffect(() => {
    if (state.status === 'idle' || (state.status === 'ringing' && state.direction === 'incoming')) {
      setMinimized(false)
    }
  }, [state.status, state.direction])

  // A call that ends while minimised: show "Call ended" in the floating window
  // briefly, then it disappears with the call (handled by status -> idle).

  // Tell the Android app when a video call is on, so pressing Home turns the
  // call into a small floating window instead of freezing the video.
  const videoLive = state.video && (state.status === 'connected' || state.status === 'connecting')
  useEffect(() => {
    const bridge = window.AbiaCallBridge
    if (!bridge || typeof bridge.setVideoCall !== 'function') return
    try {
      bridge.setVideoCall(videoLive)
    } catch {
      // Older app: nothing to do.
    }
  }, [videoLive])

  useEffect(() => {
    const onPip = (e: Event) => {
      const active = Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active)
      setPip(active)
    }
    window.addEventListener('abiaconnect-pip', onPip)
    return () => window.removeEventListener('abiaconnect-pip', onPip)
  }, [])

  if (!userId) return null

  const showCall = state.status !== 'idle' && state.peer
  const inCall = canMinimiseCall(state.status, state.direction)

  return (
    <>
      <audio ref={setAudioNode} autoPlay playsInline />
      {showCall && pip ? (
        <CallOverlay state={state} pip />
      ) : showCall && minimized && (inCall || state.status === 'ended') ? (
        <CallMiniWindow state={state} onOpen={() => setMinimized(false)} />
      ) : showCall ? (
        <CallOverlay state={state} onMinimize={inCall ? () => setMinimized(true) : undefined} />
      ) : null}
    </>
  )
}
