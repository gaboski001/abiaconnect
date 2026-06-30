// Lightweight MediaRecorder wrapper for chat voice notes.
// Records mono audio at a low bitrate, encoded as webm/opus (or mp4 on Safari/iOS).

export interface VoiceRecording {
  file: File
  durationMs: number
  mimeType: string
}

export type MicErrorKind =
  | 'denied'
  | 'dismissed'
  | 'no-device'
  | 'in-use'
  | 'insecure'
  | 'unsupported'
  | 'unknown'

export class MicError extends Error {
  kind: MicErrorKind
  constructor(kind: MicErrorKind, message: string) {
    super(message)
    this.name = 'MicError'
    this.kind = kind
  }
}

function toMicError(err: any): MicError {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new MicError(
      'denied',
      'Microphone access was blocked. Tap the lock icon in your address bar and allow microphone access, then try again.',
    )
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new MicError('no-device', 'No microphone was found on this device.')
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return new MicError(
      'in-use',
      'Your microphone is already in use by another app or tab. Close it and try again.',
    )
  }
  if (name === 'TypeError') {
    return new MicError('dismissed', 'Microphone request was dismissed. Please try again.')
  }
  return new MicError('unknown', err?.message || 'Could not start recording. Please try again.')
}

/** Check current permission state without prompting (when supported). */
export async function getMicPermissionState(): Promise<PermissionState | 'unknown'> {
  try {
    const p = (navigator as any).permissions
    if (!p?.query) return 'unknown'
    const res = await p.query({ name: 'microphone' as PermissionName })
    return res.state
  } catch {
    return 'unknown'
  }
}

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/aac',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c
  }
  return ''
}

export class VoiceRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: BlobPart[] = []
  private startedAt = 0
  private mimeType = ''
  private analyser: AnalyserNode | null = null
  private audioCtx: AudioContext | null = null

  async start(onLevel?: (level: number) => void) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new MicError(
        'unsupported',
        'Voice recording is not supported in this browser. Try the latest Chrome, Safari, or Firefox.',
      )
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      throw new MicError(
        'insecure',
        'Microphone access requires a secure (HTTPS) connection.',
      )
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (err: any) {
      throw toMicError(err)
    }
    this.mimeType = pickMimeType()
    this.recorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType, audioBitsPerSecond: 32000 } : undefined,
    )
    this.chunks = []
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data)
    }
    this.recorder.start(250)
    this.startedAt = Date.now()

    if (onLevel) {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      this.audioCtx = new AC()
      const src = this.audioCtx.createMediaStreamSource(this.stream)
      const analyser = this.audioCtx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      this.analyser = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!this.analyser) return
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        const avg = sum / data.length / 255
        onLevel(avg)
        requestAnimationFrame(tick)
      }
      tick()
    }
  }

  async stop(): Promise<VoiceRecording | null> {
    const rec = this.recorder
    const stream = this.stream
    if (!rec || !stream) return null
    return new Promise((resolve) => {
      rec.onstop = () => {
        const durationMs = Date.now() - this.startedAt
        const mime = this.mimeType || 'audio/webm'
        const ext = mime.includes('mp4') || mime.includes('aac') ? 'm4a' : 'webm'
        const blob = new Blob(this.chunks, { type: mime })
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime })
        this.cleanup()
        resolve({ file, durationMs, mimeType: mime })
      }
      rec.stop()
    })
  }

  cancel() {
    try {
      this.recorder?.stop()
    } catch {
      // ignore
    }
    this.cleanup()
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.recorder = null
    this.chunks = []
    this.analyser?.disconnect()
    this.analyser = null
    this.audioCtx?.close().catch(() => undefined)
    this.audioCtx = null
  }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
