import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { callManager, type CallState } from '@/lib/webrtcCall'
import { CallOverlay } from './CallOverlay'

export function CallProvider() {
  const { user } = useAuth()
  const profileQ = useQuery({
    queryKey: ['profile-min', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_my_profile')
      return Array.isArray(data) ? (data[0] ?? null) : data
    },
  })
  const profile = profileQ.data as
    | { display_name?: string | null; username?: string | null; avatar_url?: string | null }
    | null
    | undefined

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
  })


  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!user) return
    callManager.init({
      id: user.id,
      name: profile?.display_name || profile?.username || 'You',
      avatarUrl: profile?.avatar_url ?? null,
    })
    return () => {
      callManager.shutdown()
    }
  }, [user, profile?.display_name, profile?.username, profile?.avatar_url])

  useEffect(() => {
    const unsub = callManager.subscribe(setState)
    return () => {
      unsub()
    }
  }, [])

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
