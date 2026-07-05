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
  conversationId?: string | null
}

export type CallQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export interface CallStats {
  rttMs: number | null
  jitterMs: number | null
  packetLossPct: number | null
  bitrateKbps: number | null
}

export interface QualityEvent {
  quality: CallQuality
  at: number
  note?: string
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
  degraded: boolean
  reconnecting: boolean
  reconnectAttempts: number
  maxReconnectAttempts: number
  timeline: QualityEvent[]
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
    degraded: false,
    reconnecting: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 3,
    timeline: [],
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
  private currentJitterTargetMs = 80
  private poorSince: number | null = null
  private autoReconnectTimer: number | null = null
  private autoReconnecting = false
  private inviteRetryTimer: number | null = null
  private wasConnected = false



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
      config: { broadcast: { ack: false, self: false }, private: true },
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
    this.wasConnected = false
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
    await this.sendInvite(target, callId)
    this.startInviteRetryLoop(target, callId)
    void this.sendIncomingCallPush(target, callId)
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
    this.clearInviteRetryLoop()
    this.wasConnected = false
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
    void this.broadcastToUser(from.id, 'cancel', { callId, reason: 'rejected' })
    this.clearInviteRetryLoop()
    this.pendingOffer = null
    this.patch({ status: 'idle', callId: null, direction: null, peer: null })
  }

  private async broadcastToUser(userId: string, event: string, payload: any) {
    const ch = supabase.channel(`call-user:${userId}`, {
      config: { broadcast: { ack: false, self: false }, private: true },
    })
    try {
      await new Promise<void>((resolve) => {
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve()
        })
        window.setTimeout(() => resolve(), 2000)
      })
      await ch.send({ type: 'broadcast', event, payload })
    } finally {
      supabase.removeChannel(ch).catch(() => undefined)
    }
  }

  private async sendInvite(target: CallPeer, callId: string) {
    await this.broadcastToUser(target.id, 'invite', {
      callId,
      from: this.selfPeer,
    })
  }

  private startInviteRetryLoop(target: CallPeer, callId: string) {
    this.clearInviteRetryLoop()
    let attempts = 0
    this.inviteRetryTimer = window.setInterval(() => {
      if (this.state.callId !== callId || this.state.status !== 'calling') {
        this.clearInviteRetryLoop()
        return
      }
      attempts += 1
      if (attempts > 6) {
        this.clearInviteRetryLoop()
        return
      }
      void this.sendInvite(target, callId)
    }, 5000)
  }

  private clearInviteRetryLoop() {
    if (this.inviteRetryTimer) {
      window.clearInterval(this.inviteRetryTimer)
      this.inviteRetryTimer = null
    }
  }

  private async sendIncomingCallPush(target: CallPeer, callId: string) {
    try {
      await supabase.functions.invoke('send-push', {
        body: {
          userId: target.id,
          title: 'Incoming call',
          message: `${this.selfPeer?.name || 'Someone'} is calling you on AbiaConnect`,
          data: {
            type: 'call',
            callId,
            callerId: this.selfPeer?.id,
            callerName: this.selfPeer?.name,
            conversationId: target.conversationId || null,
            url: target.conversationId ? `/messages/${target.conversationId}` : '/messages',
          },
        },
      })
    } catch {
      // Best effort only; realtime invite remains the primary path.
    }
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
    const conversationId = this.state.peer?.conversationId
    const direction = this.state.direction
    const wasConnected = this.wasConnected
    if (notifyPeer && peerId && callId) {
      await this.sessionSend('bye', { callId }).catch(() => undefined)
      await this.broadcastToUser(peerId, 'cancel', { callId }).catch(() => undefined)
    }
    // Log a call entry in the conversation (missed or completed).
    // Only the caller writes it (single source of truth — both peers see the same row).
    if (direction === 'outgoing' && conversationId && this.userId) {
      const senderId = this.userId
      const startedAt = this.state.startedAt
      const durationSec =
        wasConnected && startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0
      const content = wasConnected
        ? `[call:ended] ${durationSec}s`
        : `[call:missed] ${error || 'No answer'}`
      void (async () => {
        try {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: senderId,
            content,
          })
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
        } catch {
          // best-effort logging only
        }
      })()
    }
    this.wasConnected = false
    this.clearInviteRetryLoop()
    this.stopStatsLoop()
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
    this.poorSince = null
    this.currentJitterTargetMs = 80
    this.clearAutoReconnect()
    this.autoReconnecting = false
    this.patch({
      status: 'ended',
      muted: false,
      error,
      quality: 'unknown',
      stats: { ...INITIAL_STATS },
      degraded: false,
      reconnecting: false,
      reconnectAttempts: 0,
      timeline: this.appendTimeline(this.state.timeline, 'unknown', error ?? 'Call ended'),
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
          timeline: [],
        })
      }
    }, 2500)
  }


  // ----- internals -----

  private onInvite(payload: any) {
    if (!payload?.callId || !payload?.from) return
    // Busy: auto-reject.
    if (this.state.status !== 'idle' && this.state.status !== 'ended') {
      void this.broadcastToUser(payload.from.id, 'cancel', {
        callId: payload.callId,
        reason: 'busy',
      })
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
    ch.on('broadcast', { event: 'restart' }, () => {
      // Peer asked us to renegotiate with ICE restart.
      if (isCaller) void this.performIceRestart()
    })

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
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      } as MediaTrackConstraints,
      video: false,
    })
    this.localStream = stream
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))

    // Apply initial encoder bitrate cap (Opus speech ~32kbps).
    this.currentTargetBitrateKbps = 32
    this.applyBitrate(this.currentTargetBitrateKbps).catch(() => undefined)

    pc.ontrack = (e) => {
      const [remote] = e.streams
      if (this.remoteAudio && remote) {
        this.remoteAudio.srcObject = remote
        this.remoteAudio.play().catch(() => undefined)
      }
      // Hint a small jitter buffer for low-latency speech (Chromium experimental).
      for (const r of pc.getReceivers()) {
        const anyR = r as unknown as { jitterBufferTarget?: number; playoutDelayHint?: number }
        try {
          if ('jitterBufferTarget' in anyR) anyR.jitterBufferTarget = 80
          else if ('playoutDelayHint' in anyR) anyR.playoutDelayHint = 0.08
        } catch {
          // ignore
        }
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) void this.sessionSend('ice', { candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected') {
        const wasConnecting = this.state.status !== 'connected'
        this.wasConnected = true
        this.patch({
          status: 'connected',
          startedAt: this.state.startedAt ?? Date.now(),
          reconnecting: false,
          timeline: wasConnecting
            ? this.appendTimeline(this.state.timeline, 'unknown', 'Connected')
            : this.state.timeline,
        })
        this.startStatsLoop()
      } else if (s === 'failed') {
        if (this.state.status === 'connected' || this.state.status === 'connecting') {
          this.scheduleAutoReconnect('ICE failed')
        }
      } else if (s === 'disconnected') {
        if (this.state.status === 'connected') {
          this.scheduleAutoReconnect('Disconnected')
        }
      } else if (s === 'closed') {
        if (this.state.status === 'connected' || this.state.status === 'connecting') {
          void this.endCall(false)
        }
      }
    }
  }

  // ----- adaptive bitrate + quality monitoring -----

  private async applyBitrate(kbps: number) {
    const pc = this.pc
    if (!pc) return
    const sender = pc.getSenders().find((s) => s.track?.kind === 'audio')
    if (!sender) return
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}]
    }
    params.encodings[0].maxBitrate = Math.max(8000, Math.floor(kbps * 1000))
    try {
      await sender.setParameters(params)
    } catch {
      // ignore browsers that reject mid-call updates
    }
  }

  private startStatsLoop() {
    this.clearInviteRetryLoop()
    this.stopStatsLoop()
    this.lastBytesReceived = 0
    this.lastBytesTimestamp = 0
    this.statsTimer = window.setInterval(() => {
      void this.pollStats()
    }, 2000)
  }

  private stopStatsLoop() {
    if (this.statsTimer != null) {
      window.clearInterval(this.statsTimer)
      this.statsTimer = null
    }
  }

  private async pollStats() {
    const pc = this.pc
    if (!pc) return
    let rttMs: number | null = null
    let jitterMs: number | null = null
    let packetLossPct: number | null = null
    let bitrateKbps: number | null = null
    try {
      const report = await pc.getStats()
      let packetsLost = 0
      let packetsReceived = 0
      report.forEach((r: any) => {
        if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
          if (typeof r.roundTripTime === 'number') rttMs = Math.round(r.roundTripTime * 1000)
          if (typeof r.jitter === 'number') jitterMs = Math.round(r.jitter * 1000)
        }
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          if (typeof r.jitter === 'number' && jitterMs == null) jitterMs = Math.round(r.jitter * 1000)
          if (typeof r.packetsLost === 'number') packetsLost += r.packetsLost
          if (typeof r.packetsReceived === 'number') packetsReceived += r.packetsReceived
          if (typeof r.bytesReceived === 'number' && typeof r.timestamp === 'number') {
            if (this.lastBytesTimestamp > 0) {
              const dBytes = r.bytesReceived - this.lastBytesReceived
              const dMs = r.timestamp - this.lastBytesTimestamp
              if (dMs > 0 && dBytes >= 0) {
                bitrateKbps = Math.round((dBytes * 8) / dMs)
              }
            }
            this.lastBytesReceived = r.bytesReceived
            this.lastBytesTimestamp = r.timestamp
          }
        }
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
          if (typeof r.currentRoundTripTime === 'number' && rttMs == null) {
            rttMs = Math.round(r.currentRoundTripTime * 1000)
          }
        }
      })
      const totalPackets = packetsLost + packetsReceived
      if (totalPackets > 0) {
        packetLossPct = Math.round((packetsLost / totalPackets) * 1000) / 10
      }
    } catch {
      // ignore
    }

    const quality = this.scoreQuality(rttMs, jitterMs, packetLossPct)
    const prev = this.state.quality
    const timeline =
      quality !== prev && quality !== 'unknown'
        ? this.appendTimeline(this.state.timeline, quality)
        : this.state.timeline
    this.patch({
      quality,
      stats: { rttMs, jitterMs, packetLossPct, bitrateKbps },
      timeline,
    })
    this.adaptBitrate(quality)
    this.trackPersistentPoor(quality)
  }

  private scoreQuality(
    rtt: number | null,
    jitter: number | null,
    loss: number | null,
  ): CallQuality {
    if (rtt == null && jitter == null && loss == null) return 'unknown'
    const lossV = loss ?? 0
    const rttV = rtt ?? 0
    const jitterV = jitter ?? 0
    if (lossV >= 8 || rttV >= 500 || jitterV >= 60) return 'poor'
    if (lossV >= 3 || rttV >= 300 || jitterV >= 30) return 'fair'
    if (lossV >= 1 || rttV >= 180 || jitterV >= 15) return 'good'
    return 'excellent'
  }

  private adaptBitrate(quality: CallQuality) {
    if (this.state.degraded) return // managed by emergency downshift
    const target =
      quality === 'poor' ? 12 : quality === 'fair' ? 20 : quality === 'good' ? 28 : 40
    if (target !== this.currentTargetBitrateKbps) {
      this.currentTargetBitrateKbps = target
      void this.applyBitrate(target)
    }
    const jt = quality === 'poor' ? 150 : quality === 'fair' ? 120 : 80
    if (jt !== this.currentJitterTargetMs) {
      this.currentJitterTargetMs = jt
      this.applyJitterTarget(jt)
    }
  }

  private applyJitterTarget(ms: number) {
    const pc = this.pc
    if (!pc) return
    for (const r of pc.getReceivers()) {
      const anyR = r as unknown as { jitterBufferTarget?: number; playoutDelayHint?: number }
      try {
        if ('jitterBufferTarget' in anyR) anyR.jitterBufferTarget = ms
        else if ('playoutDelayHint' in anyR) anyR.playoutDelayHint = ms / 1000
      } catch {
        // ignore
      }
    }
  }

  private trackPersistentPoor(quality: CallQuality) {
    if (quality === 'poor') {
      if (this.poorSince == null) this.poorSince = Date.now()
      else if (!this.state.degraded && Date.now() - this.poorSince >= 10000) {
        this.applyEmergencyDownshift()
      }
      // After downshift, if still poor for another 10s, try auto-reconnect.
      if (this.state.degraded && Date.now() - (this.poorSince ?? 0) >= 20000) {
        this.scheduleAutoReconnect('Quality remained poor')
      }
    } else if (quality === 'good' || quality === 'excellent') {
      this.poorSince = null
      if (this.state.degraded) {
        this.patch({ degraded: false })
      }
    }
  }

  // ----- auto reconnect with exponential backoff -----

  private appendTimeline(current: QualityEvent[], quality: CallQuality, note?: string): QualityEvent[] {
    const next = [...current, { quality, at: Date.now(), note }]
    // Cap to last 50 entries to bound memory.
    return next.length > 50 ? next.slice(next.length - 50) : next
  }

  private clearAutoReconnect() {
    if (this.autoReconnectTimer != null) {
      window.clearTimeout(this.autoReconnectTimer)
      this.autoReconnectTimer = null
    }
  }

  private scheduleAutoReconnect(reason: string) {
    if (this.autoReconnecting || this.autoReconnectTimer != null) return
    if (this.state.status !== 'connected' && this.state.status !== 'connecting') return
    const attempt = this.state.reconnectAttempts + 1
    if (attempt > this.state.maxReconnectAttempts) {
      void this.endCall(true, 'Connection lost after multiple retries')
      return
    }
    // Exponential backoff: 2s, 4s, 8s …
    const delay = Math.min(2000 * 2 ** (attempt - 1), 15000)
    this.patch({
      reconnecting: true,
      reconnectAttempts: attempt,
      timeline: this.appendTimeline(
        this.state.timeline,
        this.state.quality,
        `Reconnect attempt ${attempt}/${this.state.maxReconnectAttempts} in ${Math.round(delay / 1000)}s (${reason})`,
      ),
    })
    this.autoReconnectTimer = window.setTimeout(() => {
      this.autoReconnectTimer = null
      void this.runAutoReconnect()
    }, delay)
  }

  private async runAutoReconnect() {
    if (this.autoReconnecting) return
    this.autoReconnecting = true
    try {
      if (this.state.direction === 'outgoing') {
        await this.performIceRestart()
      } else {
        await this.sessionSend('restart', {})
      }
      // Give the connection up to ~8s to recover, then evaluate.
      window.setTimeout(() => {
        this.autoReconnecting = false
        const cs = this.pc?.connectionState
        if (cs === 'connected') {
          this.poorSince = null
          this.patch({
            reconnecting: false,
            reconnectAttempts: 0,
            timeline: this.appendTimeline(this.state.timeline, this.state.quality, 'Reconnect succeeded'),
          })
        } else if (cs === 'failed' || cs === 'disconnected') {
          this.scheduleAutoReconnect('Still unstable')
        } else {
          this.patch({ reconnecting: false })
        }
      }, 8000)
    } catch {
      this.autoReconnecting = false
      this.scheduleAutoReconnect('Restart threw')
    }
  }

  private applyEmergencyDownshift() {
    this.currentTargetBitrateKbps = 8
    void this.applyBitrate(8)
    this.currentJitterTargetMs = 250
    this.applyJitterTarget(250)
    this.patch({ degraded: true })
  }

  /**
   * Public: triggered by the UI "Reconnect" button. Performs an ICE restart
   * to recover from a persistently poor connection without ending the call.
   */
  async reconnect() {
    const pc = this.pc
    if (!pc) return
    if (this.state.reconnecting) return
    this.clearAutoReconnect()
    this.patch({
      reconnecting: true,
      reconnectAttempts: 0,
      timeline: this.appendTimeline(this.state.timeline, this.state.quality, 'Manual reconnect'),
    })
    try {
      if (this.state.direction === 'outgoing') {
        await this.performIceRestart()
      } else {
        // Ask caller to renegotiate.
        await this.sessionSend('restart', {})
      }
    } finally {
      window.setTimeout(() => {
        if (this.state.reconnecting) this.patch({ reconnecting: false })
      }, 6000)
    }
  }

  private async performIceRestart() {
    const pc = this.pc
    if (!pc) return
    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      await this.sessionSend('sdp', { sdp: offer })
    } catch {
      // ignore
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
