import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface RawReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface ReactionAgg {
  emoji: string
  count: number
  mine: boolean
  userIds: string[]
}

/**
 * Fetch + subscribe to reactions for a given set of message ids.
 *
 * Realtime updates cover both INSERT and DELETE for `message_reactions`. RLS
 * already restricts payloads to conversations the user participates in, so we
 * can safely apply any event whose `message_id` is in our current window.
 */
export function useMessageReactions(
  conversationId: string | undefined,
  messageIds: string[],
  userId: string | undefined,
) {
  const qc = useQueryClient()
  const idsKey = messageIds.join(',')
  const queryKey = ['message-reactions', conversationId, idsKey] as const

  const q = useQuery({
    queryKey,
    enabled: !!conversationId && messageIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_reactions' as never)
        .select('id, message_id, user_id, emoji, created_at')
        .in('message_id', messageIds)
      if (error) throw error
      return (data ?? []) as unknown as RawReaction[]
    },
  })

  // Realtime — a single channel per conversation for reaction events.
  useEffect(() => {
    if (!conversationId) return
    const ids = new Set(messageIds)
    if (ids.size === 0) return
    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row = payload.new as RawReaction
          if (!ids.has(row.message_id)) return
          qc.setQueryData<RawReaction[]>(queryKey, (prev) => {
            const list = prev ?? []
            if (list.some((r) => r.id === row.id)) return list
            return [...list, row]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const row = payload.old as Partial<RawReaction>
          qc.setQueryData<RawReaction[]>(queryKey, (prev) =>
            (prev ?? []).filter((r) => r.id !== row.id),
          )
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, idsKey, qc])

  const grouped = useMemo<Map<string, ReactionAgg[]>>(() => {
    const out = new Map<string, ReactionAgg[]>()
    for (const r of q.data ?? []) {
      const list = out.get(r.message_id) ?? []
      const existing = list.find((a) => a.emoji === r.emoji)
      if (existing) {
        existing.count += 1
        existing.userIds.push(r.user_id)
        if (r.user_id === userId) existing.mine = true
      } else {
        list.push({
          emoji: r.emoji,
          count: 1,
          mine: r.user_id === userId,
          userIds: [r.user_id],
        })
      }
      out.set(r.message_id, list)
    }
    return out
  }, [q.data, userId])

  const toggle = async (messageId: string, emoji: string) => {
    if (!userId) return
    const existing = (q.data ?? []).find(
      (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji,
    )
    if (existing) {
      // Optimistic remove.
      qc.setQueryData<RawReaction[]>(queryKey, (prev) =>
        (prev ?? []).filter((r) => r.id !== existing.id),
      )
      const { error } = await supabase
        .from('message_reactions' as never)
        .delete()
        .eq('id', existing.id)
      if (error) void q.refetch()
    } else {
      // Optimistic add.
      const optimistic: RawReaction = {
        id: `optimistic-${Date.now()}-${Math.random()}`,
        message_id: messageId,
        user_id: userId,
        emoji,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<RawReaction[]>(queryKey, (prev) => [...(prev ?? []), optimistic])
      const { data, error } = await (supabase
        .from('message_reactions' as never) as any)
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select('id, message_id, user_id, emoji, created_at')
        .maybeSingle()

      if (error) {
        qc.setQueryData<RawReaction[]>(queryKey, (prev) =>
          (prev ?? []).filter((r) => r.id !== optimistic.id),
        )
      } else if (data) {
        qc.setQueryData<RawReaction[]>(queryKey, (prev) =>
          (prev ?? []).map((r) => (r.id === optimistic.id ? (data as unknown as RawReaction) : r)),
        )
      }
    }
  }

  return { reactionsByMessage: grouped, toggleReaction: toggle }
}
