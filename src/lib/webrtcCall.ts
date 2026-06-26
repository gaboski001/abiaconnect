// Peer-to-peer voice call manager backed by Supabase Realtime broadcast signaling.
//
// Signaling channels:
//   - Each authenticated user subscribes to `call-user:{userId}` and listens for
//     `invite`, `accept`, `reject`, `cancel`, `bye` events.
//   - Once a call is accepted, both peers exchange `sdp` and `ice` payloads on a
//     dedicated `call-session:{callId}` channel.
//
// Audio only. STUN-only by default. For strict NATs add TURN servers in
// `getIceServers()` (e.g. Twilio NTS or a self-hosted coturn).

import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'

export interface CallPeer {
  id: string
  name: string
  avatarUrl?: string | null
}

export type CallQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export interface CallStats {
  rttMs: number | null
  jitterMs: number | null
  packetLossPct: number | null
  bitrateKbps: number | null
}

export interface CallState {
  status: CallStatus
  callId: string | null
  direction: 'incoming' | 'outgoing' | null
  peer: CallPeer | null
  muted: boolean
  startedAt: number | null
  error: string | null
  quality: CallQuality
  stats: CallStats
}


type Listener = (state: CallState) => void

function getIceServers(): RTCIceServer[] {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ]
}

function newId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const INITIAL_STATS: CallStats = {
  rttMs: null,
  jitterMs: null,
  packetLossPct: null,
  bitrateKbps: null,
}

class CallManager {
  private listeners = new Set<Listener>()
  private state: CallState = {
    status: 'idle',
    callId: null,
    direction: null,
    peer: null,
    muted: false,
    startedAt: null,
    error: null,
    quality: 'unknown',
    stats: { ...INITIAL_STATS },
  }
  private userId: string | null = null
  private selfPeer: CallPeer | null = null
  private userChannel: RealtimeChannel | null = null
  private sessionChannel: RealtimeChannel | null = null
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteAudio: HTMLAudioElement | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private pendingOffer: { from: CallPeer; sdp: RTCSessionDescriptionInit; callId: string } | null = null
  private statsTimer: number | null = null
  private lastBytesReceived = 0
  private lastBytesTimestamp = 0
  private currentTargetBitrateKbps = 32


  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.state)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    const snap = { ...this.state }
    this.listeners.forEach((l) => l(snap))
  }

  private patch(p: Partial<CallState>) {
    this.state = { ...this.state, ...p }
    this.emit()
  }

  /** Start listening for incoming calls on this user's channel. Idempotent. */
  init(self: CallPeer) {
    if (this.userId === self.id && this.userChannel) return
    this.teardownUserChannel()
    this.userId = self.id
    this.selfPeer = self
    const ch = supabase.channel(`call-user:${self.id}`, {
      config: { broadcast: { ack: false, self: false } },
    })
    ch.on('broadcast', { event: 'invite' }, ({ payload }) => this.onInvite(payload))
    ch.on('broadcast', { event: 'cancel' }, ({ payload }) => this.onCancel(payload))
    ch.subscribe()
    this.userChannel = ch
  }

  shutdown() {
    this.endCall(false)
    this.teardownUserChannel()
    this.userId = null
    this.selfPeer = null
  }

  private teardownUserChannel() {
    if (this.userChannel) {
      supabase.removeChannel(this.userChannel).catch(() => undefined)
      this.userChannel = null
    }
  }

  setRemoteAudioElement(el: HTMLAudioElement | null) {
    this.remoteAudio = el
  }

  /** Outgoing call to a peer. */
  async startCall(target: CallPeer) {
    if (!this.userId || !this.selfPeer) throw new Error('Call manager not initialised')
    if (this.state.status !== 'idle' && this.state.status !== 'ended') return
    const callId = newId()
    this.patch({
      status: 'calling',
      callId,
      direction: 'outgoing',
      peer: target,
      error: null,
      startedAt: null,
    })
    await this.openSessionChannel(callId, true)
    await this.setupPeer(true)
    // Send invite to callee's user channel.
    await supabase.channel(`call-user:${target.id}`).send({
      type: 'broadcast',
      event: 'invite',
      payload: {
        callId,
        from: this.selfPeer,
      },
    })
    // Time out unanswered calls after 35s.
    window.setTimeout(() => {
      if (this.state.callId === callId && this.state.status === 'calling') {
        void this.endCall(true, 'No answer')
      }
    }, 35000)
  }

  /** Accept the pending incoming invite. */
  async accept() {
    if (!this.pendingOffer) return
    const { from, callId } = this.pendingOffer
    this.patch({ status: 'connecting', callId, direction: 'incoming', peer: from })
    await this.openSessionChannel(callId, false)
    await this.setupPeer(false)
    // Notify caller we accepted; they will create and send the offer.
    await this.sessionSend('accept', { from: this.selfPeer })
    this.pendingOffer = null
  }

  reject() {
    if (!this.pendingOffer) return
    const { from, callId } = this.pendingOffer
    supabase
      .channel(`call-user:${from.id}`)
      .send({ type: 'broadcast', event: 'cancel', payload: { callId, reason: 'rejected' } })
      .catch(() => undefined)
    this.pendingOffer = null
    this.patch({ status: 'idle', callId: null, direction: null, peer: null })
  }

  toggleMute() {
    if (!this.localStream) return
    const next = !this.state.muted
    this.localStream.getAudioTracks().forEach((t) => (t.enabled = !next))
    this.patch({ muted: next })
  }

  async endCall(notifyPeer = true, error: string | null = null) {
    const peerId = this.state.peer?.id
    const callId = this.state.callId
    if (notifyPeer && peerId && callId) {
      await this.sessionSend('bye', { callId }).catch(() => undefined)
      await supabase
        .channel(`call-user:${peerId}`)
        .send({ type: 'broadcast', event: 'cancel', payload: { callId } })
        .catch(() => undefined)
    }
    this.pc?.getSenders().forEach((s) => s.track?.stop())
    this.pc?.close()
    this.pc = null
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.pendingCandidates = []
    if (this.sessionChannel) {
      supabase.removeChannel(this.sessionChannel).catch(() => undefined)
      this.sessionChannel = null
    }
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null
    }
    this.patch({
      status: 'ended',
      muted: false,
      error,
    })
    window.setTimeout(() => {
      if (this.state.status === 'ended') {
        this.patch({
          status: 'idle',
          callId: null,
          direction: null,
          peer: null,
          startedAt: null,
          error: null,
        })
      }
    }, 2500)
  }

  // ----- internals -----

  private onInvite(payload: any) {
    if (!payload?.callId || !payload?.from) return
    // Busy: auto-reject.
    if (this.state.status !== 'idle' && this.state.status !== 'ended') {
      supabase
        .channel(`call-user:${payload.from.id}`)
        .send({ type: 'broadcast', event: 'cancel', payload: { callId: payload.callId, reason: 'busy' } })
        .catch(() => undefined)
      return
    }
    this.pendingOffer = { from: payload.from, sdp: payload.sdp, callId: payload.callId }
    this.patch({
      status: 'ringing',
      callId: payload.callId,
      direction: 'incoming',
      peer: payload.from,
    })
  }

  private onCancel(payload: any) {
    if (!payload?.callId) return
    if (this.state.callId !== payload.callId) return
    void this.endCall(false, payload?.reason === 'busy' ? 'User is busy' : null)
  }

  private async openSessionChannel(callId: string, isCaller: boolean) {
    const ch = supabase.channel(`call-session:${callId}`, {
      config: { broadcast: { ack: false, self: false } },
    })
    ch.on('broadcast', { event: 'accept' }, () => this.onAccept(isCaller))
    ch.on('broadcast', { event: 'sdp' }, ({ payload }) => this.onSdp(payload, isCaller))
    ch.on('broadcast', { event: 'ice' }, ({ payload }) => this.onIce(payload))
    ch.on('broadcast', { event: 'bye' }, () => this.endCall(false))
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
      })
    })
    this.sessionChannel = ch
  }

  private async sessionSend(event: string, payload: any) {
    if (!this.sessionChannel) return
    await this.sessionChannel.send({ type: 'broadcast', event, payload })
  }

  private async setupPeer(isCaller: boolean) {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() })
    this.pc = pc
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
    this.localStream = stream
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))

    pc.ontrack = (e) => {
      const [remote] = e.streams
      if (this.remoteAudio && remote) {
        this.remoteAudio.srcObject = remote
        this.remoteAudio.play().catch(() => undefined)
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) void this.sessionSend('ice', { candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        this.patch({ status: 'connected', startedAt: Date.now() })
      } else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        if (this.state.status === 'connected' || this.state.status === 'connecting') {
          void this.endCall(true, s === 'failed' ? 'Connection lost' : null)
        }
      }
    }
  }

  private async onAccept(isCaller: boolean) {
    if (!isCaller || !this.pc) return
    this.patch({ status: 'connecting' })
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true })
    await this.pc.setLocalDescription(offer)
    await this.sessionSend('sdp', { sdp: offer })
  }

  private async onSdp(payload: any, isCaller: boolean) {
    const pc = this.pc
    if (!pc || !payload?.sdp) return
    const desc = new RTCSessionDescription(payload.sdp)
    await pc.setRemoteDescription(desc)
    // Flush queued ICE candidates.
    for (const c of this.pendingCandidates) {
      try {
        await pc.addIceCandidate(c)
      } catch {
        // ignore
      }
    }
    this.pendingCandidates = []
    if (!isCaller && desc.type === 'offer') {
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await this.sessionSend('sdp', { sdp: answer })
    }
  }

  private async onIce(payload: any) {
    if (!payload?.candidate) return
    const pc = this.pc
    if (!pc) return
    if (!pc.remoteDescription) {
      this.pendingCandidates.push(payload.candidate)
      return
    }
    try {
      await pc.addIceCandidate(payload.candidate)
    } catch {
      // ignore
    }
  }
}

export const callManager = new CallManager()

export function useIsCallSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia
}
