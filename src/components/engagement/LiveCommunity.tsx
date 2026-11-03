import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { REASON_LABELS } from '@/lib/engagement'
import { SHOW_ONLINE_FROM } from '@/lib/quietNumbers'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { MY_REWARDS_KEY } from './DailyRewardCard'

/* ---------------------------------------------------------------------------
 * Members online (Supabase presence). One shared channel for the whole app.
 * ------------------------------------------------------------------------- */

let onlineCount = 0
const listeners = new Set<() => void>()
const setOnline = (n: number) => {
  onlineCount = n
  listeners.forEach((l) => l())
}

export function useOnlineCount(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => onlineCount,
    () => 0,
  )
}

/**
 * Mount once (MainLayout). Signed-in members announce themselves; everyone
 * can read the count. Only an anonymous key is shared, never who is online.
 */
export function CommunityPresence() {
  const { user } = useAuth()
  useEffect(() => {
    // Random per device: counts members without revealing who they are.
    const key = `${user?.id ? 'm' : 'v'}:${Math.random().toString(36).slice(2, 12)}`
    const ch = supabase.channel('community-online', { config: { presence: { key } } })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      setOnline(Object.keys(state).filter((k) => k.startsWith('m:')).length)
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED' && user?.id) void ch.track({ at: Date.now() })
    })
    return () => {
      supabase.removeChannel(ch).catch(() => undefined)
    }
  }, [user?.id])
  return null
}

export function OnlineMembersPill({ className = '' }: { className?: string }) {
  const n = useOnlineCount()
  // "1 member online" (often just you) makes the site look empty.
  if (n < SHOW_ONLINE_FROM) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 ${className}`}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      {n === 1 ? '1 member online' : `${n.toLocaleString()} members online`}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * "+5 points" toasts as you earn (realtime on your own points ledger).
 * ------------------------------------------------------------------------- */

export function PointsToaster() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const onInsert = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      const amount = Number(payload.new.amount ?? 0)
      const reason = String(payload.new.reason ?? '')
      void qc.invalidateQueries({ queryKey: MY_REWARDS_KEY })
      // The reward card celebrates check-ins itself.
      if (reason === 'daily_checkin' || reason === 'streak_bonus' || amount === 0) return
      const label = REASON_LABELS[reason] ?? 'Points'
      if (amount > 0) toast.success(`+${amount} points · ${label}`)
    },
    [qc],
  )
  useRealtimeChannel({
    channelName: `points:${user?.id ?? 'anon'}`,
    enabled: !!user,
    subscriptions: [
      {
        filter: { event: 'INSERT', schema: 'public', table: 'points_ledger', filter: `user_id=eq.${user?.id}` },
        handler: onInsert as never,
      },
    ],
    deps: [user?.id],
  })
  return null
}

/* ---------------------------------------------------------------------------
 * "N new discussions" banner (like social feeds): new posts arrive live, and
 * the list refreshes only when the reader taps, so nothing jumps under them.
 * ------------------------------------------------------------------------- */

export function NewDiscussionsBanner({ queryKeys }: { queryKeys: unknown[][] }) {
  const qc = useQueryClient()
  const [count, setCount] = useState(0)
  const onInsert = useCallback((payload: { new: Record<string, unknown> }) => {
    if (payload.new.is_deleted) return
    if (payload.new.subgroup_id) return
    setCount((c) => c + 1)
  }, [])
  useRealtimeChannel({
    channelName: 'home-new-threads',
    subscriptions: [{ filter: { event: 'INSERT', schema: 'public', table: 'threads' }, handler: onInsert as never }],
  })
  if (count === 0) return null
  return (
    <div className="sticky top-16 z-30 flex justify-center">
      <button
        type="button"
        onClick={() => {
          setCount(0)
          for (const key of queryKeys) void qc.invalidateQueries({ queryKey: key })
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-[13px] font-bold text-[#0B1F0B] shadow-lg active:scale-95"
      >
        <ArrowUp className="size-4" />
        {count === 1 ? '1 new discussion' : `${count} new discussions`}
      </button>
    </div>
  )
}
