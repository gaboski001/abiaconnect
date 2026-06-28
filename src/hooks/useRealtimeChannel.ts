import { useEffect } from 'react'
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresChangesFilter,
} from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface RealtimePostgresSubscription {
  /** Postgres changes filter: event/schema/table[/filter]. */
  filter: RealtimePostgresChangesFilter<'*' | 'INSERT' | 'UPDATE' | 'DELETE'>
  /** Handler invoked for every matching change. */
  handler: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

export interface UseRealtimeChannelOptions {
  /** Stable channel name prefix — a unique per-mount suffix is appended automatically. */
  channelName: string
  /** One or more postgres_changes subscriptions to attach before subscribe(). */
  subscriptions: RealtimePostgresSubscription[]
  /** When false, the effect is a no-op (e.g. while the user is loading). */
  enabled?: boolean
  /** Re-subscribe whenever any of these values change. */
  deps?: ReadonlyArray<unknown>
}

/**
 * Safely subscribe to Supabase realtime postgres_changes.
 *
 * Handles the StrictMode / re-render footguns that produce
 * "cannot add `postgres_changes` callbacks ... after subscribe()":
 *   - Always appends a unique suffix to the channel name so a remount
 *     never reuses a channel that is already subscribed.
 *   - Attaches every `.on(...)` listener before `.subscribe()`.
 *   - Tears the channel down on unmount or when deps change.
 */
export function useRealtimeChannel({
  channelName,
  subscriptions,
  enabled = true,
  deps = [],
}: UseRealtimeChannelOptions) {
  useEffect(() => {
    if (!enabled) return
    if (!subscriptions.length) return

    const uniqueName = `${channelName}:${Math.random().toString(36).slice(2)}`
    let channel: RealtimChannelLike = supabase.channel(uniqueName)

    // Attach ALL listeners before subscribing.
    for (const sub of subscriptions) {
      channel = channel.on('postgres_changes', sub.filter, sub.handler)
    }

    const active = channel as RealtimeChannel
    active.subscribe()

    return () => {
      void supabase.removeChannel(active)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, ...deps])
}

// `.on()` returns the channel; alias for readability above.
type RealtimChannelLike = RealtimeChannel
