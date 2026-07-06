import { useEffect, useRef, useState } from 'react'
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

/**
 * Heartbeat channel that keeps Supabase Realtime connected and auto-recovers
 * from drops (network flaps, tab suspend, device sleep, VPN switches, etc.)
 * without requiring a page refresh.
 *
 * Strategy:
 *  - A single dedicated channel (`realtime-status-heartbeat`) mirrors the
 *    underlying socket status.
 *  - On CHANNEL_ERROR / TIMED_OUT / CLOSED we tear down and re-subscribe with
 *    exponential backoff (capped), so transient failures self-heal.
 *  - We force an immediate reconnect on `online`, `visibilitychange` (visible),
 *    `focus`, and Capacitor `App` resume events — these are the moments where
 *    the browser silently kills the WebSocket.
 *  - StrictMode-safe: unique channel suffix per mount, full teardown on unmount.
 */
export function RealtimeStatus({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>('connecting')
  const attemptsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const teardown = async () => {
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        try {
          await supabase.removeChannel(ch)
        } catch {
          /* ignore */
        }
      }
    }

    const connect = () => {
      if (!mountedRef.current) return
      clearTimer()
      // Ensure the socket itself is up. `connect()` is a no-op if already open.
      try {
        const sock = (supabase.realtime as unknown as { connect?: () => void })
        sock.connect?.()
      } catch {
        /* ignore */
      }

      // Fresh channel each attempt — Realtime refuses to re-subscribe a closed one.
      const name = `realtime-status-heartbeat:${Math.random().toString(36).slice(2)}`
      const channel = supabase.channel(name)
      channelRef.current = channel

      setStatus((s) => (s === 'connected' ? s : 'connecting'))

      channel.subscribe((state) => {
        if (!mountedRef.current) return
        if (state === 'SUBSCRIBED') {
          attemptsRef.current = 0
          setStatus('connected')
        } else if (
          state === 'CHANNEL_ERROR' ||
          state === 'TIMED_OUT' ||
          state === 'CLOSED'
        ) {
          setStatus('disconnected')
          scheduleReconnect()
        } else {
          setStatus('connecting')
        }
      })
    }

    const scheduleReconnect = (immediate = false) => {
      if (!mountedRef.current) return
      clearTimer()
      const attempt = attemptsRef.current++
      const delay = immediate
        ? 0
        : Math.min(15_000, 500 * Math.pow(2, Math.min(attempt, 5))) // 0.5s → 15s
      timerRef.current = setTimeout(async () => {
        await teardown()
        connect()
      }, delay)
    }

    const forceReconnect = () => {
      // User-visible transition (network back, tab focus). Reset backoff.
      attemptsRef.current = 0
      scheduleReconnect(true)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') forceReconnect()
    }

    connect()

    window.addEventListener('online', forceReconnect)
    window.addEventListener('focus', forceReconnect)
    document.addEventListener('visibilitychange', onVisibility)

    // Optional Capacitor resume hook — dynamically imported so web builds don't break.
    let appHandles: Array<{ remove: () => void }> = []
    let cancelledApp = false
    ;(async () => {
      try {
        const dynImport = new Function('m', 'return import(m)') as (
          m: string,
        ) => Promise<any>
        const mod = await dynImport('@capacitor/app')
        if (cancelledApp || !mod?.App) return
        const h1 = await mod.App.addListener('resume', forceReconnect)
        const h2 = await mod.App.addListener(
          'appStateChange',
          (s: { isActive: boolean }) => {
            if (s?.isActive) forceReconnect()
          },
        )
        appHandles = [h1, h2].filter(Boolean)
      } catch {
        /* not native — ignore */
      }
    })()

    return () => {
      mountedRef.current = false
      cancelledApp = true
      clearTimer()
      window.removeEventListener('online', forceReconnect)
      window.removeEventListener('focus', forceReconnect)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const h of appHandles) {
        try {
          h.remove()
        } catch {
          /* ignore */
        }
      }
      void teardown()
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
