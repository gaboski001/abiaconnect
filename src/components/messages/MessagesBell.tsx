import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function MessagesBell() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const unreadQ = useQuery({
    queryKey: ['messages-unread', user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data: convs, error: cErr } = await supabase
          .from('conversations')
          .select('id')
          .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        if (cErr) throw cErr
        const ids = (convs ?? []).map((c) => c.id)
        if (!ids.length) return 0
        const { count, error } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', ids)
          .eq('is_read', false)
          .neq('sender_id', user!.id)
        if (error) throw error
        return count ?? 0
      } catch {
        return 0
      }
    },
  })

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`messages-bell:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          qc.invalidateQueries({ queryKey: ['messages-unread', user.id] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, qc])

  if (!user) return null
  const count = unreadQ.data ?? 0

  return (
    <Button asChild variant="ghost" size="icon" aria-label="Messages" className="relative">
      <Link to="/messages">
        <MessageCircle />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </Button>
  )
}

export default MessagesBell
