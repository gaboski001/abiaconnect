import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { useThrottledCallback } from '@/hooks/useThrottledCallback'

import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck, ChevronRight, Sparkles } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { NotificationRow, notifHref, notifIcon } from '@/components/notifications/NotificationBell'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

type Filter = 'all' | 'unread' | 'reply' | 'mention' | 'system'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'reply', label: 'Replies' },
  { value: 'mention', label: 'Mentions' },
  { value: 'system', label: 'System' },
]

export default function Notifications() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const notifsQ = useQuery({
    queryKey: ['notifications-all', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
  })

  const invalidateNotifs = useThrottledCallback(
    useCallback(() => {
      if (!user) return
      qc.invalidateQueries({ queryKey: ['notifications-all', user.id] })
    }, [qc, user]),
    800,
  )

  useRealtimeChannel({
    enabled: !!user,
    channelName: `notifications-page:${user?.id ?? 'anon'}`,
    deps: [user?.id],
    subscriptions: user
      ? [
          {
            filter: { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
            handler: invalidateNotifs,
          },
        ]
      : [],
  })


  const filtered = useMemo(() => {
    const list = notifsQ.data ?? []
    switch (filter) {
      case 'unread':
        return list.filter((n) => !n.is_read)
      case 'reply':
        return list.filter((n) => n.type === 'reply')
      case 'mention':
        return list.filter((n) => n.type === 'mention')
      case 'system':
        return list.filter((n) => n.type === 'system')
      default:
        return list
    }
  }, [notifsQ.data, filter])

  const unreadCount = useMemo(() => (notifsQ.data ?? []).filter((n) => !n.is_read).length, [notifsQ.data])

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    qc.invalidateQueries({ queryKey: ['notifications-all', user.id] })
    qc.invalidateQueries({ queryKey: ['notifications-unread', user.id] })
    qc.invalidateQueries({ queryKey: ['notifications-recent', user.id] })
  }

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      qc.invalidateQueries({ queryKey: ['notifications-all', user?.id] })
      qc.invalidateQueries({ queryKey: ['notifications-unread', user?.id] })
    }
    navigate(notifHref(n))
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SEO title="Notifications" description="See your latest alerts and updates on AbiaConnect." path="/notifications" />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#091220] p-4 text-white sm:p-5" style={{ boxShadow: PREMIUM_SHADOW }}>
        <div className="absolute inset-0 opacity-95" style={{ background: 'linear-gradient(145deg, rgba(5,12,22,0.98) 8%, rgba(10,19,34,0.96) 55%, rgba(5,11,20,1) 100%)' }} />
        <div className="absolute -right-12 top-0 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.18)' }} />
        <div className="absolute left-0 top-8 h-32 w-32 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.18)' }} />

        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200/80" style={{ background: GOLD_GRADIENT_SOFT }}>
            <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
            Notification center
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[1.75rem] font-black tracking-tight sm:text-3xl">Stay on top of every update</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300/76">
                Replies, mentions, system notices, and community activity now feel cleaner, faster, and easier to scan without wasting space on mobile.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={markAllRead}
              className="h-12 rounded-2xl border border-white/10 px-4 text-slate-950 hover:opacity-95"
              style={{ backgroundImage: GOLD_GRADIENT, boxShadow: unreadCount ? GOLD_SHADOW : 'none' }}
            >
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <Metric label="Unread" value={String(unreadCount)} />
            <Metric label="Showing" value={String(filtered.length)} />
            <Metric label="Realtime" value="Live" />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[1.9rem] border border-white/10 bg-[rgba(8,14,26,0.9)] p-4 text-white sm:p-5" style={{ boxShadow: PREMIUM_SHADOW }}>
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex gap-2 pb-1">
            {FILTERS.map((item) => {
              const active = filter === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition"
                  style={active ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, borderColor: 'transparent', boxShadow: GOLD_SHADOW } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(226,232,240,0.78)', borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {notifsQ.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-[1.4rem] bg-white/[0.05]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center text-sm text-slate-300/70">
            You're all caught up.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => {
              const Icon = notifIcon(n.type)
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex w-full items-start gap-4 rounded-[1.4rem] border px-4 py-4 text-left transition',
                    n.is_read
                      ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                      : 'border-[#F8C301]/20 bg-[rgba(248,195,1,0.08)] hover:bg-[rgba(248,195,1,0.11)]',
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={n.is_read ? { background: 'rgba(255,255,255,0.06)' } : { backgroundImage: GOLD_GRADIENT }}>
                    <Icon className="h-5 w-5" style={n.is_read ? { color: 'rgba(226,232,240,0.88)' } : { color: MOBILE_BRAND.ink }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-6 text-slate-100">{n.message || n.type}</p>
                      {!n.is_read ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MOBILE_BRAND.gold }} /> : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-300/76">
                        Open <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/62">{label}</p>
      <p className="mt-2 text-xl font-black text-white sm:text-2xl">{value}</p>
    </div>
  )
}
