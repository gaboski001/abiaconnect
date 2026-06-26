import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { callManager, type CallState } from '@/lib/webrtcCall'
import { useProfile } from '@/hooks/useProfile'
import { CallOverlay } from './CallOverlay'

export function CallProvider() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const [state, setState] = useState<CallState>({
    status: 'idle',
    callId: null,
    direction: null,
    peer: null,
    muted: false,
    startedAt: null,
    error: null,
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!user) return
    callManager.init({
      id: user.id,
      name: profile?.display_name || profile?.username || 'User',
      avatarUrl: profile?.avatar_url ?? null,
    })
    return () => callManager.shutdown()
  }, [user, profile?.display_name, profile?.username, profile?.avatar_url])

  useEffect(() => callManager.subscribe(setState), [])

  useEffect(() => {
    callManager.setRemoteAudioElement(audioRef.current)
  }, [])

  if (!user) return null

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline />
      {state.status !== 'idle' && state.peer && <CallOverlay state={state} />}
    </>
  )
}
