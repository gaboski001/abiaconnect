import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Status = 'connecting' | 'connected' | 'disconnected'

const LABEL: Record<Status, string> = {
  connecting: 'Realtime connecting…',
  connected: 'Realtime connected',
  disconnected: 'Realtime disconnected',
}

const DOT: Record<Status, string> = {
  connecting: 'bg-amber-400 animate-pulse',
  connected: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  disconnected: 'bg-rose-500',
}

export function RealtimeStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>('connecting')

  useEffect(() => {
    const channel = supabase.channel('realtime-status-heartbeat')
    channel.subscribe((state) => {
      if (state === 'SUBSCRIBED') setStatus('connected')
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED')
        setStatus('disconnected')
      else setStatus('connecting')
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-live="polite"
            aria-label={LABEL[status]}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2 py-1 text-xs text-muted-foreground',
              className,
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', DOT[status])} />
            <span className="hidden sm:inline">{LABEL[status]}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{LABEL[status]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default RealtimeStatus
