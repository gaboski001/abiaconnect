import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { AtSign, Bell, MessageSquare, ThumbsUp, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { playNotificationChime } from '@/lib/notificationSound'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'

export interface NotificationRow {
  id: string
  user_id: string
  type: 'reply' | 'mention' | 'vote' | 'follow' | 'system' | string
  message?: string | null
  link?: string | null
  thread_id?: string | null
  is_read: boolean
  created_at: string
}

export function notifIcon(type: string) {
  switch (type) {
    case 'reply':
      return MessageSquare
    case 'mention':
      return AtSign
    case 'vote':
      return ThumbsUp
    case 'follow':
      return UserPlus
    default:
      return Bell
  }
}

export function notifHref(n: NotificationRow) {
  if (n.link) return n.link
  if (n.thread_id) return `/thread/${n.thread_id}`
  return '/notifications'
}

export function NotificationBell() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const unreadQ = useQuery({
    queryKey: ['notifications-unread', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
  })

  const recentQ = useQuery({
    queryKey: ['notifications-recent', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
  })

  useRealtimeChannel({
    enabled: !!user,
    channelName: `notifications:${user?.id ?? 'anon'}`,
    deps: [user?.id],
    subscriptions: user
      ? [
          {
            filter: {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            handler: (payload) => {
              if (payload.eventType === 'INSERT') {
                playNotificationChime()
              }
              qc.invalidateQueries({ queryKey: ['notifications-unread', user.id] })
              qc.invalidateQueries({ queryKey: ['notifications-recent', user.id] })
              qc.invalidateQueries({ queryKey: ['notifications-all', user.id] })
            },
          },
        ]
      : [],
  })

  const markAllRead = async () => {
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    qc.invalidateQueries({ queryKey: ['notifications-unread', user.id] })
    qc.invalidateQueries({ queryKey: ['notifications-recent', user.id] })
    qc.invalidateQueries({ queryKey: ['notifications-all', user.id] })
  }

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      qc.invalidateQueries({ queryKey: ['notifications-unread', user?.id] })
      qc.invalidateQueries({ queryKey: ['notifications-recent', user?.id] })
    }
    navigate(notifHref(n))
  }

  if (!user) return null
  const count = unreadQ.data ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs text-primary hover:underline"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {recentQ.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (recentQ.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            recentQ.data!.map((n) => {
              const Icon = notifIcon(n.type)
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left flex gap-3 items-start px-3 py-2 hover:bg-muted/60 transition-colors border-l-2',
                    n.is_read ? 'border-transparent' : 'border-secondary bg-secondary/5',
                  )}
                >
                  <div className="rounded-full bg-muted p-1.5 shrink-0">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm line-clamp-2">{n.message || n.type}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default NotificationBell
