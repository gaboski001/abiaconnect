import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  NotificationRow,
  notifHref,
  notifIcon,
} from '@/components/notifications/NotificationBell'

type Filter = 'all' | 'unread' | 'reply' | 'mention' | 'system'

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

  // Realtime updates
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications-page:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ['notifications-all', user.id] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, qc])

  // Auto-mark visible as read after 2s
  useEffect(() => {
    if (!user || !notifsQ.data?.some((n) => !n.is_read)) return
    const t = setTimeout(async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      qc.invalidateQueries({ queryKey: ['notifications-all', user.id] })
      qc.invalidateQueries({ queryKey: ['notifications-unread', user.id] })
      qc.invalidateQueries({ queryKey: ['notifications-recent', user.id] })
    }, 2000)
    return () => clearTimeout(t)
  }, [notifsQ.data, user, qc])

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

  const markAllRead = async () => {
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary/10 p-2 text-secondary">
            <Bell className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4 mr-1" /> Mark all as read
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="reply">Replies</TabsTrigger>
          <TabsTrigger value="mention">Mentions</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
      </Tabs>

      {notifsQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground rounded-xl border border-dashed">
          You're all caught up.
        </div>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {filtered.map((n) => {
            const Icon = notifIcon(n.type)
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full text-left flex gap-3 items-start p-4 hover:bg-muted/40 transition-colors border-l-4',
                  n.is_read ? 'border-transparent' : 'border-secondary bg-secondary/5',
                )}
              >
                <div className="rounded-full bg-muted p-2 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.message || n.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-secondary mt-2" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
