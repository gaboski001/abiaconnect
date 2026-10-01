// Peer-to-peer voice and video call manager backed by Supabase Realtime broadcast signaling.
//
// Signaling channels:
//   - Each authenticated user subscribes to `call-user:{userId}` and listens for
//     `invite`, `accept`, `reject`, `cancel`, `bye` events.
//   - Once a call is accepted, both peers exchange `sdp` and `ice` payloads on a
//     dedicated `call-session:{callId}` channel.
//
// Voice or video. ICE servers (STUN + TURN relay) come from the
// `call-ice-servers` edge function; without TURN configured there it falls
// back to STUN only, which fails behind strict / carrier-grade NAT.

import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { areCallsEnabled } from '@/lib/callPreferences'

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

export interface CallDiagnostics {
  hasPeerConnection: boolean
  peerConnectionState: RTCPeerConnectionState
  iceConnectionState: RTCIceConnectionState

  localMicPresent: boolean
  localMicEnabled: boolean
  localMicMuted: boolean
  localMicLabel: string | null
  localMicReadyState: MediaStreamTrack['readyState'] | null

  remoteTrackCount: number
  remoteTracksLive: number

  audioElementBound: boolean
  audioSrcObjectAttached: boolean
  audioSinkTrackCount: number
  audioElementPaused: boolean
  audioElementMuted: boolean
  audioElementVolume: number
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
  /**
   * Outgoing calls only. True once the callee's device has received our
   * invite and is displaying the incoming-call UI (i.e. their phone is
   * actually ringing). Lets the caller UI distinguish "Calling…" (invite
   * in flight) from "Ringing…" (peer notified).
   */
  remoteRinging: boolean
  /** Video call (camera) rather than voice only. */
  video: boolean
  /** Our camera is sending (video calls). */
  cameraOn: boolean
  /** The other person's camera is on (video calls). */
  remoteCameraOn: boolean
  /** Which camera we use. */
  facing: 'user' | 'environment'
  /** Audio plays on the loudspeaker (vs earpiece / headset). */
  speakerOn: boolean
  /** Bumped whenever the local or remote media streams change, so video views rebind. */
  mediaVersion: number
  /** Short message for the call screen, e.g. why a video call became voice only. */
  notice: string | null
}

/** Fields reset at the start / end of every call. */
const MEDIA_DEFAULTS = {
  video: false,
  cameraOn: false,
  remoteCameraOn: false,
  facing: 'user' as const,
  speakerOn: false,
}



type Listener = (state: CallState) => void

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
]

let iceCache: { servers: RTCIceServer[]; expiresAt: number } | null = null
let iceInflight: Promise<RTCIceServer[]> | null = null

/**
 * STUN + TURN servers from the `call-ice-servers` edge function, cached for
 * half their lifetime. Never blocks a call for long: falls back to public STUN
 * after 3s or on any error.
 */
async function getIceServers(): Promise<RTCIceServer[]> {
  if (iceCache && Date.now() < iceCache.expiresAt) return iceCache.servers
  if (!iceInflight) {
    iceInflight = (async () => {
      try {
        const res = await Promise.race([
          supabase.functions.invoke('call-ice-servers', { body: {} }),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 3000)),
        ])
        const servers = (res as { data?: { iceServers?: RTCIceServer[]; ttl?: number } }).data
        if (servers?.iceServers?.length) {
          const ttlMs = Math.max(60, servers.ttl ?? 3600) * 1000
          iceCache = { servers: servers.iceServers, expiresAt: Date.now() + ttlMs / 2 }
          return servers.iceServers
        }
      } catch {
        // fall through to public STUN
      } finally {
        iceInflight = null
      }
      return FALLBACK_ICE_SERVERS
    })()
  }
  return iceInflight
}

type AudioRoute = 'speaker' | 'earpiece' | 'reset'

/** Native Android audio routing (MainActivity.CallJsBridge). No-op elsewhere. */
function setNativeAudioRoute(route: AudioRoute) {
  try {
    const bridge = (window as unknown as { AbiaCallBridge?: { setAudioRoute?: (r: string) => void } })
      .AbiaCallBridge
    bridge?.setAudioRoute?.(route)
  } catch {
    // ignore
  }
}

export function canSwitchAudioRoute(): boolean {
  const bridge = (window as unknown as { AbiaCallBridge?: { setAudioRoute?: unknown } }).AbiaCallBridge
  return typeof bridge?.setAudioRoute === 'function'
}

function mediaErrorMessage(err: unknown, video: boolean): string {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return video
      ? 'Allow camera and microphone access to make video calls.'
      : 'Allow microphone access to make calls.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return video ? 'No camera or microphone was found.' : 'No microphone was found.'
  }
  if (name === 'NotReadableError') {
    return 'Your microphone or camera is being used by another app.'
  }
  return 'Could not access your microphone.'
}

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48000,
} as MediaTrackConstraints

function videoConstraints(facing: 'user' | 'environment'): MediaTrackConstraints {
  return {
    facingMode: facing,
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 24, max: 30 },
  }
}

/** Time allowed from "answered" to media actually flowing before we give up. */
const CONNECT_TIMEOUT_MS = 25_000

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
    remoteRinging: false,
    ...MEDIA_DEFAULTS,
    mediaVersion: 0,
    notice: null,
  }

  private userId: string | null = null
  private selfPeer: CallPeer | null = null
  private userChannel: RealtimeChannel | null = null
  private sessionChannel: RealtimeChannel | null = null
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteAudio: HTMLAudioElement | null = null
  private pendingCandidates: RTCIceCandidateInit[] = []
  private pendingOffer: { from: CallPeer; sdp: RTCSessionDescriptionInit; callId: string; video: boolean } | null = null
  private remoteStream: MediaStream | null = null
  private connectTimer: number | null = null
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
  /**
   * Recently cancelled call ids (by us or by the peer). Used so a late
   * `invite` for a call the user already hung up on is auto-declined and
   * never surfaces a ringing UI. Bounded + time-pruned to avoid unbounded
   * growth on long-lived sessions.
   */
  private cancelledCallIds = new Map<string, number>()
  private static CANCELLED_TTL_MS = 60_000
  /**
   * If the user tapped "Answer" on the FCM call notification BEFORE the
   * realtime `invite` event reached this device (cold start / slow socket),
   * we remember the callId here. As soon as the matching invite arrives,
   * we auto-accept it so the ring stops immediately and the call connects
   * — instead of surfacing a ringing UI the user has to accept a second time.
   */
  private pendingAcceptCallId: string | null = null
  private pendingAcceptExpiresAt = 0
  private static PENDING_ACCEPT_TTL_MS = 20_000

  /**
   * Called from the native Answer action when the realtime invite may not
   * have arrived yet. Safe to call repeatedly; expires after 20s so a stale
   * queued accept can't hijack the next incoming call.
   */
  queuePendingAccept(callId: string) {
    if (!callId) return
    this.pendingAcceptCallId = callId
    this.pendingAcceptExpiresAt = Date.now() + CallManager.PENDING_ACCEPT_TTL_MS
  }

  private consumePendingAcceptFor(callId: string): boolean {
    if (!this.pendingAcceptCallId) return false
    if (Date.now() > this.pendingAcceptExpiresAt) {
      this.pendingAcceptCallId = null
      return false
    }
    if (this.pendingAcceptCallId !== callId) return false
    this.pendingAcceptCallId = null
    return true
  }



  getState(): CallState {
    return this.state
  }

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
    ch.on('broadcast', { event: 'ringing' }, ({ payload }) => this.onRingingAck(payload))
    ch.subscribe()
    this.userChannel = ch
    // Warm the TURN credentials so the first call doesn't wait for them.
    void getIceServers()
  }

  /** Remote media (audio + video) for the call screen. */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /** Our camera/mic stream, for the self-view. */
  getLocalStream(): MediaStream | null {
    return this.localStream
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
    // If a peer connection is already receiving remote audio when the sink
    // element mounts (e.g. auth hydrated after the first invite arrived),
    // rebind the live tracks so we don't play into the void.
    if (el && this.pc) {
      const remoteStream = new MediaStream()
      for (const r of this.pc.getReceivers()) {
        if (r.track && r.track.kind === 'audio') {
          try { remoteStream.addTrack(r.track) } catch { /* ignore duplicates */ }
        }
      }
      if (remoteStream.getAudioTracks().length > 0) {
        el.srcObject = remoteStream
        el.muted = false
        el.volume = 1
        el.play().catch(() => undefined)
      }
    }
  }

  /**
   * Snapshot of low-level media state for the in-app diagnostics panel.
   * Safe to call at any time — returns sensible defaults when no call is
   * active. Read-only; does not mutate the session.
   */
  getDiagnostics(): CallDiagnostics {
    const local = this.localStream
    const micTracks = local?.getAudioTracks() ?? []
    const micTrack = micTracks[0] ?? null

    const receivers = this.pc?.getReceivers() ?? []
    const remoteAudioReceivers = receivers.filter((r) => r.track?.kind === 'audio')
    const remoteTracks = remoteAudioReceivers
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => Boolean(t))

    const el = this.remoteAudio
    const sinkStream = (el?.srcObject as MediaStream | null) ?? null
    const sinkTracks = sinkStream?.getAudioTracks() ?? []

    return {
      hasPeerConnection: !!this.pc,
      peerConnectionState: this.pc?.connectionState ?? 'closed',
      iceConnectionState: this.pc?.iceConnectionState ?? 'closed',

      localMicPresent: !!micTrack,
      localMicEnabled: micTrack?.enabled ?? false,
      localMicMuted: this.state.muted,
      localMicLabel: micTrack?.label ?? null,
      localMicReadyState: micTrack?.readyState ?? null,

      remoteTrackCount: remoteTracks.length,
      remoteTracksLive: remoteTracks.filter((t) => t.readyState === 'live').length,

      audioElementBound: !!el,
      audioSrcObjectAttached: !!sinkStream,
      audioSinkTrackCount: sinkTracks.length,
      audioElementPaused: el?.paused ?? true,
      audioElementMuted: el?.muted ?? false,
      audioElementVolume: el?.volume ?? 0,
    }
  }

  /**
   * Get the microphone (and camera for video calls). If the camera fails on a
   * video call we continue as a voice call rather than failing outright.
   */
  private async acquireMedia(video: boolean): Promise<{ stream: MediaStream; video: boolean }> {
    if (video) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: videoConstraints('user'),
        })
        return { stream, video: true }
      } catch {
        // Camera refused/unavailable (or an app version without camera
        // permission): fall back to a voice call below.
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false })
    return { stream, video: false }
  }

  /** Outgoing call to a peer. Throws a user-readable Error if it can't start. */
  async startCall(target: CallPeer, opts: { video?: boolean } = {}) {
    if (!this.userId || !this.selfPeer) throw new Error('Calling is not ready yet. Please try again.')
    if (!areCallsEnabled()) throw new Error('Calling is turned off in your settings')
    if (this.state.status !== 'idle' && this.state.status !== 'ended') return
    const wantVideo = !!opts.video

    // Ask for the mic/camera BEFORE ringing the other person, so a refused
    // permission never leaves them with a phantom call.
    let media: { stream: MediaStream; video: boolean }
    try {
      media = await this.acquireMedia(wantVideo)
    } catch (err) {
      throw new Error(mediaErrorMessage(err, wantVideo))
    }

    const callId = newId()
    this.wasConnected = false
    this.localStream = media.stream
    this.patch({
      status: 'calling',
      callId,
      direction: 'outgoing',
      peer: target,
      error: null,
      startedAt: null,
      remoteRinging: false,
      ...MEDIA_DEFAULTS,
      video: media.video,
      cameraOn: media.video,
      speakerOn: media.video,
      mediaVersion: this.state.mediaVersion + 1,
      notice: wantVideo && !media.video ? 'Camera unavailable — calling with voice only.' : null,
    })

    try {
      // Register the call session so realtime RLS grants both participants
      // access to the private `call-session:{callId}` channel.
      const { error: sessErr } = await supabase.from('call_sessions').insert({
        call_id: callId,
        caller_id: this.userId,
        callee_id: target.id,
      })
      if (sessErr) throw sessErr
      await this.openSessionChannel(callId, true)
      await this.setupPeer(true)
    } catch {
      if (this.state.callId === callId) {
        void this.endCall(false, 'Could not start the call. Check your internet connection.')
      }
      return
    }
    if (this.state.callId !== callId) return // hung up while setting up

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

  /**
   * Accept the pending incoming invite. `video: false` answers a video call
   * as voice only.
   */
  async accept(opts: { video?: boolean } = {}) {
    const offer = this.pendingOffer
    if (!offer) return
    // Claim it immediately so a double tap can't set up two connections.
    this.pendingOffer = null
    const { from, callId } = offer
    this.clearInviteRetryLoop()
    this.wasConnected = false
    const wantVideo = offer.video && opts.video !== false

    let media: { stream: MediaStream; video: boolean }
    try {
      media = await this.acquireMedia(wantVideo)
    } catch (err) {
      // Can't answer without a microphone: decline cleanly and explain why.
      this.rememberCancelled(callId)
      this.sendCancelWithRetries(from.id, callId, 'unavailable')
      this.patch({ status: 'ended', callId, peer: from, direction: 'incoming', error: mediaErrorMessage(err, wantVideo) })
      this.scheduleIdleReset()
      return
    }
    if (this.cancelledCallIds.has(callId)) {
      // Caller hung up while we were asking for permissions.
      media.stream.getTracks().forEach((t) => t.stop())
      return
    }
    this.localStream = media.stream
    this.patch({
      status: 'connecting',
      callId,
      direction: 'incoming',
      peer: from,
      video: offer.video,
      cameraOn: media.video,
      speakerOn: offer.video,
      mediaVersion: this.state.mediaVersion + 1,
      notice: wantVideo && !media.video ? 'Camera unavailable — they can still hear you.' : null,
    })
    try {
      await this.openSessionChannel(callId, false)
      await this.setupPeer(false)
      // Notify caller we accepted; they will create and send the offer.
      await this.sessionSend('accept', { from: this.selfPeer })
      await this.sessionSend('media', { cameraOn: media.video })
    } catch {
      void this.endCall(true, 'Could not connect the call. Check your internet connection.')
    }
  }

  /** Turn our camera on/off (video calls). */
  toggleCamera() {
    const track = this.localStream?.getVideoTracks()[0]
    if (!track) return
    const next = !this.state.cameraOn
    track.enabled = next
    this.patch({ cameraOn: next })
    void this.sessionSend('media', { cameraOn: next }).catch(() => undefined)
  }

  /** Swap between front and back camera (video calls). */
  async switchCamera() {
    const pc = this.pc
    const stream = this.localStream
    const oldTrack = stream?.getVideoTracks()[0]
    if (!pc || !stream || !oldTrack) return
    const facing = this.state.facing === 'user' ? 'environment' : 'user'
    try {
      // Release the current camera first: many phones can't open both at once.
      oldTrack.stop()
      const next = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facing), audio: false })
      const newTrack = next.getVideoTracks()[0]
      newTrack.enabled = this.state.cameraOn
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video' || s.track === oldTrack)
      await sender?.replaceTrack(newTrack)
      stream.removeTrack(oldTrack)
      stream.addTrack(newTrack)
      this.patch({ facing, mediaVersion: this.state.mediaVersion + 1 })
    } catch {
      // Couldn't open the other camera: reopen the original one.
      try {
        const back = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints(this.state.facing),
          audio: false,
        })
        const t = back.getVideoTracks()[0]
        t.enabled = this.state.cameraOn
        await pc.getSenders().find((s) => s.track === oldTrack || s.track?.kind === 'video')?.replaceTrack(t)
        stream.removeTrack(oldTrack)
        stream.addTrack(t)
        this.patch({ mediaVersion: this.state.mediaVersion + 1 })
      } catch {
        // leave as is
      }
    }
  }

  /** Loudspeaker on/off (Android app). */
  setSpeaker(on: boolean) {
    setNativeAudioRoute(on ? 'speaker' : 'earpiece')
    this.patch({ speakerOn: on })
  }

  private scheduleIdleReset() {
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

  private clearConnectTimer() {
    if (this.connectTimer != null) {
      window.clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
  }

  /** Fail fast instead of spinning on "Connecting…" forever (e.g. blocked network). */
  private armConnectTimer(callId: string) {
    this.clearConnectTimer()
    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null
      if (this.state.callId === callId && this.state.status === 'connecting' && !this.wasConnected) {
        void this.endCall(true, "Couldn't connect the call. Please try again.")
      }
    }, CONNECT_TIMEOUT_MS)
  }

  reject() {
    if (!this.pendingOffer) return
    const { from, callId } = this.pendingOffer
    this.rememberCancelled(callId)
    this.sendCancelWithRetries(from.id, callId, 'rejected')
    this.clearInviteRetryLoop()
    this.pendingOffer = null
    this.patch({ status: 'idle', callId: null, direction: null, peer: null })
  }

  /**
   * Broadcast a `cancel` several times over the first few seconds so a peer
   * whose realtime channel is still catching up (cold start after FCM, brief
   * WebView pause, transient network drop) still receives the hangup and
   * stops ringing. `onCancel` is idempotent so extra deliveries are no-ops.
   */
  private sendCancelWithRetries(peerId: string, callId: string, reason?: string) {
    this.rememberCancelled(callId)
    const payload: Record<string, unknown> = { callId }
    if (reason) payload.reason = reason
    const attempts = [0, 400, 1200, 3000, 6000]
    for (const delay of attempts) {
      window.setTimeout(() => {
        void this.broadcastToUser(peerId, 'cancel', payload).catch(() => undefined)
      }, delay)
    }
  }

  private rememberCancelled(callId: string) {
    this.pruneCancelled()
    this.cancelledCallIds.set(callId, Date.now())
  }

  private pruneCancelled() {
    const cutoff = Date.now() - CallManager.CANCELLED_TTL_MS
    for (const [id, at] of this.cancelledCallIds) {
      if (at < cutoff) this.cancelledCallIds.delete(id)
    }
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
      video: this.state.video,
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
      // FCM v1 rejects a `data` payload if any value is null/undefined — the
      // whole push silently drops, so the callee never sees the heads-up when
      // the app is closed. Build a strings-only object.
      const data: Record<string, string> = {
        type: 'call',
        callType: this.state.video ? 'video' : 'voice',
        callId,
        callerId: this.selfPeer?.id ?? '',
        callerName: this.selfPeer?.name ?? 'Someone',
        url: target.conversationId ? `/messages/${target.conversationId}` : '/messages',
      }
      if (target.conversationId) data.conversationId = target.conversationId
      await supabase.functions.invoke('send-push', {
        body: {
          userId: target.id,
          title: this.state.video ? 'Incoming video call' : 'Incoming call',
          message: `${this.selfPeer?.name || 'Someone'} is ${this.state.video ? 'video ' : ''}calling you on AbiaConnect`,
          data,
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
      // Fire-and-forget: don't await, so hangup UI is instant.
      // Retry the cancel broadcast so a peer whose realtime channel is still
      // subscribing (cold start after FCM, backgrounded WebView, brief
      // network blip) still receives the hangup and stops ringing. onCancel
      // is idempotent, so extra deliveries are harmless.
      void this.sessionSend('bye', { callId }).catch(() => undefined)
      this.sendCancelWithRetries(peerId, callId)
    }
    // Log a call entry in the conversation (missed or completed).
    // Only the caller writes it (single source of truth — both peers see the same row).
    if (direction === 'outgoing' && conversationId && this.userId) {
      const senderId = this.userId
      const startedAt = this.state.startedAt
      const durationSec =
        wasConnected && startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0
      const tag = this.state.video ? ':video' : ''
      const content = wasConnected
        ? `[call:ended${tag}] ${durationSec}s`
        : `[call:missed${tag}] ${error || 'No answer'}`
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
    this.clearConnectTimer()
    this.stopStatsLoop()
    if (this.state.speakerOn || this.state.status === 'connected' || this.state.status === 'connecting') {
      setNativeAudioRoute('reset')
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
    this.remoteStream = null
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
      remoteRinging: false,
      cameraOn: false,
      remoteCameraOn: false,
      speakerOn: false,
      notice: null,
      mediaVersion: this.state.mediaVersion + 1,
      timeline: this.appendTimeline(this.state.timeline, 'unknown', error ?? 'Call ended'),
    })
    this.scheduleIdleReset()
  }


  // ----- internals -----

  private onInvite(payload: any) {
    if (!payload?.callId || !payload?.from) return
    this.pruneCancelled()
    // Late invite for a call already hung up on either side — bounce a cancel
    // back so the caller (whose own hangup broadcast may have raced our late
    // subscribe) stops ringing/spinning immediately.
    if (this.cancelledCallIds.has(payload.callId)) {
      this.sendCancelWithRetries(payload.from.id, payload.callId, 'cancelled')
      return
    }
    // User has disabled calls in settings — silently decline so the caller
    // sees a normal "unavailable" cancel instead of an endless ring.
    if (!areCallsEnabled()) {
      this.rememberCancelled(payload.callId)
      this.sendCancelWithRetries(payload.from.id, payload.callId, 'unavailable')
      return
    }
    // retry that matches the call we're already handling — otherwise once
    // the callee accepts (status becomes 'connecting'/'connected'), the next
    // retry would fall through to the "busy" branch and cancel the call.
    if (this.state.callId === payload.callId) return
    if (this.pendingOffer?.callId === payload.callId) return
    // Busy: auto-reject a genuinely-different incoming call.
    if (this.state.status !== 'idle' && this.state.status !== 'ended') {
      this.rememberCancelled(payload.callId)
      this.sendCancelWithRetries(payload.from.id, payload.callId, 'busy')
      return
    }
    const video = payload.video === true
    this.pendingOffer = { from: payload.from, sdp: payload.sdp, callId: payload.callId, video }
    // If the user already tapped Answer on the system notification before
    // this realtime invite arrived, connect right away — no second ring,
    // no lingering "ringing" icon.
    if (this.consumePendingAcceptFor(payload.callId)) {
      void this.broadcastToUser(payload.from.id, 'ringing', {
        callId: payload.callId,
        from: this.selfPeer,
      })
      void this.accept()
      return
    }
    this.patch({
      status: 'ringing',
      callId: payload.callId,
      direction: 'incoming',
      peer: payload.from,
      error: null,
      notice: null,
      ...MEDIA_DEFAULTS,
      video,
    })
    // Tell the caller their invite reached us and our device is now ringing,
    // so their UI can flip from "Calling…" to "Ringing…".
    void this.broadcastToUser(payload.from.id, 'ringing', {
      callId: payload.callId,
      from: this.selfPeer,
    })
  }

  private onRingingAck(payload: any) {
    if (!payload?.callId) return
    if (this.state.callId !== payload.callId) return
    if (this.state.direction !== 'outgoing') return
    if (this.state.status !== 'calling') return
    if (this.state.remoteRinging) return
    this.patch({ remoteRinging: true })
  }

  private onCancel(payload: any) {
    if (!payload?.callId) return
    // Always remember cancellations so any late-arriving invite retry for the
    // same callId is auto-rejected before we ever start ringing.
    this.rememberCancelled(payload.callId)
    // Pending (not yet accepted) invite matches — clear it so we can never
    // surface a ringing UI for an already-cancelled call.
    if (this.pendingOffer?.callId === payload.callId) {
      this.pendingOffer = null
    }
    if (this.state.callId !== payload.callId) return
    // Ignore a stale "busy" cancel that arrives after we've already progressed
    // past the calling phase (caused by our own retry pinging the peer after
    // they accepted). Only honour it while we're still waiting for pickup.
    if (payload?.reason === 'busy' && this.state.status !== 'calling') return
    // Already tearing down — idempotent no-op.
    if (this.state.status === 'ended' || this.state.status === 'idle') return
    void this.endCall(false, payload?.reason === 'busy' ? 'User is busy' : null)

  }

  private async openSessionChannel(callId: string, isCaller: boolean) {
    const ch = supabase.channel(`call-session:${callId}`, {
      config: { broadcast: { ack: false, self: false }, private: true },
    })
    ch.on('broadcast', { event: 'accept' }, () => this.onAccept(isCaller))
    ch.on('broadcast', { event: 'sdp' }, ({ payload }) => this.onSdp(payload, isCaller))
    ch.on('broadcast', { event: 'ice' }, ({ payload }) => this.onIce(payload))
    ch.on('broadcast', { event: 'bye' }, () => this.endCall(false))
    ch.on('broadcast', { event: 'media' }, ({ payload }) => {
      if (typeof payload?.cameraOn === 'boolean') this.patch({ remoteCameraOn: payload.cameraOn })
    })
    ch.on('broadcast', { event: 'restart' }, () => {
      // Peer asked us to renegotiate with ICE restart.
      if (isCaller) void this.performIceRestart()
    })

    // Never wait forever: a channel that can't subscribe fails the call setup.
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('signaling timeout')), 10_000)
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timer)
          resolve()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timer)
          reject(new Error(`signaling ${status}`))
        }
      })
    }).catch((err) => {
      supabase.removeChannel(ch).catch(() => undefined)
      throw err
    })
    this.sessionChannel = ch
  }

  private async sessionSend(event: string, payload: any) {
    if (!this.sessionChannel) return
    await this.sessionChannel.send({ type: 'broadcast', event, payload })
  }

  private async setupPeer(isCaller: boolean) {
    // Fully release any prior audio binding before wiring a new session —
    // stale srcObject from a previous call has been observed to cause the
    // local mic loopback ("hears himself") on Android WebView.
    if (this.remoteAudio) {
      try { this.remoteAudio.pause() } catch { /* ignore */ }
      this.remoteAudio.srcObject = null
      this.remoteAudio.muted = false
      this.remoteAudio.volume = 1
    }

    const pc = new RTCPeerConnection({ iceServers: await getIceServers(), bundlePolicy: 'max-bundle' })
    this.pc = pc
    const stream = this.localStream
    if (!stream) throw new Error('No local media')
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    // A voice call can still RECEIVE nothing but audio; a video call must be
    // able to receive video even if our own camera failed.
    if (this.state.video && stream.getVideoTracks().length === 0) {
      pc.addTransceiver('video', { direction: 'recvonly' })
    }

    // Apply initial encoder bitrate cap (Opus speech ~32kbps).
    this.currentTargetBitrateKbps = 32
    this.applyBitrate(this.currentTargetBitrateKbps).catch(() => undefined)
    this.applyVideoBitrate('good')

    // Build a dedicated remote MediaStream so we only ever attach REMOTE
    // tracks to the playback element — never the local mic — regardless of
    // what the browser's ontrack event hands us.
    const remoteStream = new MediaStream()
    this.remoteStream = remoteStream
    if (this.remoteAudio) this.remoteAudio.srcObject = remoteStream

    pc.ontrack = (e) => {
      if (e.track.kind === 'video') {
        try { remoteStream.addTrack(e.track) } catch { /* ignore duplicates */ }
        this.patch({ mediaVersion: this.state.mediaVersion + 1 })
        return
      }
      if (e.track.kind !== 'audio') return
      try { remoteStream.addTrack(e.track) } catch { /* ignore duplicates */ }
      if (this.remoteAudio) {
        // Re-bind in case the element was reset elsewhere.
        if (this.remoteAudio.srcObject !== remoteStream) {
          this.remoteAudio.srcObject = remoteStream
        }
        this.remoteAudio.muted = false
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
        if (wasConnecting && !this.wasConnected) {
          // Voice calls start on the earpiece, video calls on the loudspeaker.
          setNativeAudioRoute(this.state.speakerOn ? 'speaker' : 'earpiece')
        }
        this.clearConnectTimer()
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

  /** Cap the camera bitrate to suit the network (no-op on voice calls). */
  private applyVideoBitrate(quality: CallQuality) {
    const pc = this.pc
    if (!pc) return
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
    if (!sender) return
    const kbps = quality === 'poor' ? 200 : quality === 'fair' ? 400 : quality === 'good' ? 700 : 1000
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
    params.encodings[0].maxBitrate = kbps * 1000
    sender.setParameters(params).catch(() => undefined)
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
    if (quality !== prev && quality !== 'unknown') this.applyVideoBitrate(quality)
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
    // Callee has answered — stop retrying the invite so a late retry can't
    // race with their new call state and get bounced back as "busy".
    this.clearInviteRetryLoop()
    if (this.state.status !== 'calling') return // duplicate accept
    this.patch({ status: 'connecting' })
    if (this.state.callId) this.armConnectTimer(this.state.callId)
    void this.sessionSend('media', { cameraOn: this.state.cameraOn }).catch(() => undefined)
    try {
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      await this.sessionSend('sdp', { sdp: offer })
    } catch {
      void this.endCall(true, "Couldn't connect the call. Please try again.")
    }
  }

  private async onSdp(payload: any, isCaller: boolean) {
    const pc = this.pc
    if (!pc || !payload?.sdp) return
    const desc = new RTCSessionDescription(payload.sdp)
    // A duplicate/late answer would throw "wrong state" and break the call.
    if (desc.type === 'answer' && pc.signalingState !== 'have-local-offer') return
    if (!isCaller && desc.type === 'offer' && this.state.callId) this.armConnectTimer(this.state.callId)
    try {
      await pc.setRemoteDescription(desc)
    } catch {
      return
    }
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
      try {
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await this.sessionSend('sdp', { sdp: answer })
      } catch {
        void this.endCall(true, "Couldn't connect the call. Please try again.")
      }
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
