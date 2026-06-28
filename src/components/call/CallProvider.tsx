import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { callManager, type CallState } from '@/lib/webrtcCall'
import { CallOverlay } from './CallOverlay'

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

  useEffect(() => {
    callManager.setRemoteAudioElement(audioRef.current)
  }, [])

  if (!userId) return null

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />
      {state.status !== 'idle' && state.peer && <CallOverlay state={state} />}
    </>
  )
}
