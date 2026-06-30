import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function VoiceBubble({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [dur, setDur] = useState(0)
  const [cur, setCur] = useState(0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onMeta = () => setDur(a.duration || 0)
    const onTime = () => setCur(a.currentTime || 0)
    const onEnd = () => {
      setPlaying(false)
      setCur(0)
    }
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = async () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      try {
        await a.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
    }
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a || !dur) return
    const v = Number(e.target.value)
    a.currentTime = (v / 100) * dur
    setCur(a.currentTime)
  }

  const pct = dur ? (cur / dur) * 100 : 0

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl p-2 pr-3 min-w-[220px] max-w-[280px]',
        mine ? 'bg-secondary-foreground/10' : 'bg-background/60',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
          'bg-primary text-primary-foreground hover:opacity-90',
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="relative h-1.5 w-full rounded-full bg-foreground/15">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={seek}
            aria-label="Seek voice message"
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
        <div className="flex justify-between text-[10px] tabular-nums opacity-70">
          <span>{fmt(cur)}</span>
          <span>{fmt(dur)}</span>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  )
}

export default VoiceBubble
