import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  VoiceRecorder as Recorder,
  formatDuration,
  getMicPermissionState,
  MicError,
} from '@/lib/voiceRecorder'

interface Props {
  disabled?: boolean
  onSend: (file: File, durationMs: number) => void
  /** Extra classes for the idle mic button. */
  className?: string
}

export function VoiceRecorderButton({ disabled, onSend, className }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [busy, setBusy] = useState(false)
  const recorderRef = useRef<Recorder | null>(null)
  const tickRef = useRef<number | null>(null)

  useEffect(() => () => recorderRef.current?.cancel(), [])

  const start = async () => {
    if (disabled || recording) return
    // Pre-check permission so we can show a clearer message before prompting.
    const state = await getMicPermissionState()
    if (state === 'denied') {
      toast.error('Microphone is blocked', {
        description:
          'Open your browser site settings (lock icon in the address bar) and allow microphone access for this site, then try again.',
        duration: 7000,
      })
      return
    }
    try {
      const rec = new Recorder()
      recorderRef.current = rec
      setLevel(0)
      await rec.start((l) => setLevel(l))
      setRecording(true)
      const startedAt = Date.now()
      setElapsed(0)
      tickRef.current = window.setInterval(() => {
        const e = Date.now() - startedAt
        setElapsed(e)
        if (e > 5 * 60 * 1000) void stopAndSend()
      }, 200)
    } catch (err: any) {
      recorderRef.current = null
      if (err instanceof MicError) {
        const titleByKind: Record<string, string> = {
          denied: 'Microphone access blocked',
          dismissed: 'Microphone request dismissed',
          'no-device': 'No microphone detected',
          'in-use': 'Microphone unavailable',
          insecure: 'Secure connection required',
          unsupported: 'Recording not supported',
          unknown: 'Could not start recording',
        }
        toast.error(titleByKind[err.kind] ?? 'Could not start recording', {
          description: err.message,
          duration: 7000,
        })
      } else {
        toast.error('Could not start recording', {
          description: err?.message || 'Please try again.',
        })
      }
    }
  }

  const cleanupTimer = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  const cancel = () => {
    cleanupTimer()
    recorderRef.current?.cancel()
    recorderRef.current = null
    setRecording(false)
    setElapsed(0)
    setLevel(0)
  }

  const stopAndSend = async () => {
    if (!recorderRef.current) return
    cleanupTimer()
    setBusy(true)
    try {
      const result = await recorderRef.current.stop()
      recorderRef.current = null
      if (result && result.durationMs >= 500) {
        onSend(result.file, result.durationMs)
      } else {
        toast.message('Hold longer to record')
      }
    } finally {
      setBusy(false)
      setRecording(false)
      setElapsed(0)
      setLevel(0)
    }
  }

  if (!recording) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        onClick={start}
        disabled={disabled || busy}
        aria-label="Record voice note"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
      </Button>
    )
  }

  const MIN_MS = 500
  const tooShort = elapsed < MIN_MS

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Recording voice note, ${formatDuration(elapsed)}`}
      className="flex items-center gap-2 flex-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 ring-1 ring-destructive/30"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 gap-1 text-destructive hover:bg-destructive/15"
        onClick={cancel}
        disabled={busy}
        aria-label="Cancel recording and discard"
      >
        <Trash2 className="h-4 w-4" />
        <span className="text-xs font-medium">Cancel</span>
      </Button>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-xs tabular-nums font-semibold text-destructive">
          REC {formatDuration(elapsed)}
        </span>
        <div className="flex items-end gap-[2px] h-6 flex-1 px-2 min-w-0">
          {Array.from({ length: 24 }).map((_, i) => {
            const phase = (Date.now() / 120 + i) % 24
            const h = Math.max(3, Math.round((level * 18 + Math.sin(phase) * 4 + 4)))
            return (
              <span
                key={i}
                className="w-[2px] rounded bg-destructive/70"
                style={{ height: `${h}px` }}
              />
            )
          })}
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        className="h-8 w-8"
        onClick={stopAndSend}
        disabled={busy || tooShort}
        aria-label={tooShort ? 'Keep recording, too short to send' : 'Send voice note'}
        title={tooShort ? 'Hold longer to record' : 'Send voice note'}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function isAudioAttachment(type?: string | null) {
  return !!type && type.startsWith('audio/')
}

export function VoiceMessageBubble({
  url,
  mine,
}: {
  url: string
  mine: boolean
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.pause()
    else void a.play()
  }

  return (
    <div className={cn('flex items-center gap-2 min-w-[180px]')}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
          mine ? 'bg-secondary-foreground/15' : 'bg-primary/15 text-primary',
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 w-full bg-foreground/15 rounded overflow-hidden">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: duration ? `${(current / duration) * 100}%` : '0%' }}
          />
        </div>
        <div className="text-[10px] opacity-70 tabular-nums mt-0.5">
          {formatDuration((duration ? current : 0) * 1000)} / {formatDuration(duration * 1000)}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d)) setDuration(d)
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
        }}
      />
    </div>
  )
}
