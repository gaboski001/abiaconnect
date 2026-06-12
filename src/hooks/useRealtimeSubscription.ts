import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>

interface UseRealtimeOptions {
  channelName: string
  table: string
  event?: ChangeEvent
  filter?: string
  onInsert?: (payload: Payload) => void
  onUpdate?: (payload: Payload) => void
  onDelete?: (payload: Payload) => void
  enabled?: boolean
}

/**
 * Generic Supabase Realtime subscription hook.
 * Automatically subscribes on mount and removes the channel on unmount.
 */
export function useRealtimeSubscription({
  channelName,
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const insertRef = useRef(onInsert)
  const updateRef = useRef(onUpdate)
  const deleteRef = useRef(onDelete)

  useEffect(() => {
    insertRef.current = onInsert
    updateRef.current = onUpdate
    deleteRef.current = onDelete
  }, [onInsert, onUpdate, onDelete])

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(channelName)
      .on(
        // @ts-expect-error supabase-js types for postgres_changes are overly strict
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload: Payload) => {
          if (payload.eventType === 'INSERT') insertRef.current?.(payload)
          else if (payload.eventType === 'UPDATE') updateRef.current?.(payload)
          else if (payload.eventType === 'DELETE') deleteRef.current?.(payload)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [channelName, table, event, filter, enabled])
}

export default useRealtimeSubscription
