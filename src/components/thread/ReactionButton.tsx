import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const sb = supabase as any

export const REACTIONS = [
  { id: 'like', emoji: '👍🏾', label: 'Like', color: 'text-blue-600 dark:text-blue-400' },
  { id: 'love', emoji: '❤️', label: 'Love', color: 'text-rose-600 dark:text-rose-400' },
  { id: 'haha', emoji: '😂', label: 'Haha', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'wow', emoji: '😮', label: 'Wow', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'sad', emoji: '😢', label: 'Sad', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'pray', emoji: '🙏🏾', label: 'Amen', color: 'text-violet-600 dark:text-violet-400' },
  { id: 'clap', emoji: '👏🏾', label: 'Well done', color: 'text-emerald-600 dark:text-emerald-400' },
] as const
export type ReactionId = (typeof REACTIONS)[number]['id']
export interface ReactionCount {
  reaction: string
  total: number
}

const byId = (id: string | null | undefined) => REACTIONS.find((r) => r.id === id) ?? REACTIONS[0]

/** Hold (or hover on a computer) to see the other reactions, tap to like. */
const HOLD_MS = 450

/**
 * The Like button with its reaction bar and the reaction summary. It only
 * shows and reports choices; the caller saves them.
 */
export function ReactionPicker({
  mine,
  counts,
  total,
  ready,
  disabled,
  compact = false,
  onChoose,
}: {
  /** The member's own reaction, or null. */
  mine: string | null
  /** Totals per reaction, most used first (only when reactions are switched on). */
  counts: ReactionCount[]
  total: number
  /** False until the reactions database update is in: plain likes only. */
  ready: boolean
  disabled: boolean
  compact?: boolean
  onChoose: (next: ReactionId | null) => void
}) {
  const [open, setOpen] = useState(false)
  const holdTimer = useRef<number | undefined>(undefined)
  const hoverTimer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const wrap = useRef<HTMLDivElement>(null)
  const chosen = mine ? byId(mine) : null

  const choose = (id: ReactionId) => {
    setOpen(false)
    onChoose(chosen?.id === id ? null : id)
  }

  // Close the bar when tapping anywhere else.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  useEffect(
    () => () => {
      window.clearTimeout(holdTimer.current)
      window.clearTimeout(hoverTimer.current)
    },
    [],
  )

  const top = ready ? counts.slice(0, 3) : [{ reaction: 'like', total }]

  return (
    <div className="flex items-center gap-2">
      <div
        ref={wrap}
        className="relative"
        onPointerEnter={(e) => {
          // Hovering opens the bar on a computer; phones use a long press.
          if (disabled || !ready || e.pointerType !== 'mouse') return
          window.clearTimeout(hoverTimer.current)
          hoverTimer.current = window.setTimeout(() => setOpen(true), 600)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return
          window.clearTimeout(hoverTimer.current)
          hoverTimer.current = window.setTimeout(() => setOpen(false), 350)
        }}
      >
        <AnimatePresence>
          {open ? (
            <motion.div
              role="menu"
              aria-label="Choose a reaction"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="absolute bottom-full left-0 z-30 mb-2 flex gap-0.5 rounded-full border border-border bg-popover px-1.5 py-1 shadow-xl"
            >
              {REACTIONS.map((r, i) => (
                <motion.button
                  key={r.id}
                  type="button"
                  role="menuitem"
                  aria-label={r.label}
                  title={r.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                  whileHover={{ scale: 1.35, y: -4 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => choose(r.id)}
                  className={cn(
                    'flex items-center justify-center rounded-full leading-none',
                    compact ? 'size-9 text-[23px]' : 'size-10 text-[26px]',
                    chosen?.id === r.id && 'bg-muted',
                  )}
                >
                  {r.emoji}
                </motion.button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          type="button"
          disabled={disabled}
          aria-pressed={!!chosen}
          aria-haspopup="menu"
          title={disabled ? 'Sign in to react' : ready ? 'Tap to like. Hold for more reactions.' : 'Like'}
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            if (disabled || !ready || e.button !== 0) return
            held.current = false
            window.clearTimeout(holdTimer.current)
            holdTimer.current = window.setTimeout(() => {
              held.current = true
              setOpen(true)
              if ('vibrate' in navigator) navigator.vibrate?.(15)
            }, HOLD_MS)
          }}
          onPointerUp={() => window.clearTimeout(holdTimer.current)}
          onPointerLeave={() => window.clearTimeout(holdTimer.current)}
          onClick={() => {
            if (held.current) {
              held.current = false
              return
            }
            setOpen(false)
            onChoose(chosen ? null : 'like')
          }}
          className={cn(
            'inline-flex select-none items-center gap-1.5 rounded-md text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60',
            '[-webkit-touch-callout:none] [touch-action:manipulation]',
            compact ? 'h-8 px-2.5' : 'h-9 border border-input bg-background px-3',
            chosen?.color,
          )}
        >
          <span className={compact ? 'text-[15px] leading-none' : 'text-base leading-none'} aria-hidden>
            {chosen ? chosen.emoji : '👍🏾'}
          </span>
          {chosen ? chosen.label : 'Like'}
        </button>
      </div>

      {total > 0 ? (
        <span className="flex items-center gap-1 text-sm text-muted-foreground" aria-label={`${total} reactions`}>
          <span className="flex -space-x-1" aria-hidden>
            {top.map((r) => (
              <span key={r.reaction} className="flex size-5 items-center justify-center rounded-full bg-background text-[13px] ring-2 ring-background">
                {byId(r.reaction).emoji}
              </span>
            ))}
          </span>
          {total.toLocaleString()}
        </span>
      ) : null}
    </div>
  )
}

/** Reactions on a thread, with their own loading and saving. */
export function ReactionButton({
  threadId,
  userId,
  onChanged,
  fallbackCount = 0,
}: {
  threadId: string
  userId: string | null
  /** The plain like count, shown until reactions are switched on in the database. */
  fallbackCount?: number
  /** Called after a change so the page can refresh its like count. */
  onChanged?: () => void
}) {
  const qc = useQueryClient()
  const countsQ = useQuery({
    queryKey: ['thread-reactions', threadId],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_thread_reactions', { _thread_id: threadId })
      // Before the reactions database update: plain likes only.
      if (error) return null
      return ((data ?? []) as ReactionCount[]).map((r) => ({ ...r, total: Number(r.total) }))
    },
  })
  const ready = countsQ.data !== null
  const mineQ = useQuery({
    queryKey: ['my-thread-reaction', threadId, userId],
    enabled: !!userId && countsQ.isFetched,
    queryFn: async () => {
      const { data, error } = await sb
        .from('thread_votes')
        .select(ready ? 'id, value, reaction' : 'id, value')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; value: number; reaction?: string | null } | null
    },
  })

  const react = useMutation({
    mutationFn: async (next: ReactionId | null) => {
      if (!userId) throw new Error('Sign in to react')
      const row = mineQ.data
      if (next === null) {
        if (row) {
          const { error } = await sb.from('thread_votes').delete().eq('id', row.id)
          if (error) throw error
        }
        return
      }
      if (row) {
        const { error } = await sb.from('thread_votes').update(ready ? { value: 1, reaction: next } : { value: 1 }).eq('id', row.id)
        if (error) throw error
      } else {
        const { error } = await sb
          .from('thread_votes')
          .insert({ thread_id: threadId, user_id: userId, value: 1, ...(ready ? { reaction: next } : {}) })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thread-reactions', threadId] })
      qc.invalidateQueries({ queryKey: ['my-thread-reaction', threadId] })
      onChanged?.()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That didn’t work. Please try again.'),
  })

  const counts = countsQ.data ?? []
  return (
    <ReactionPicker
      mine={mineQ.data?.value === 1 ? (mineQ.data.reaction ?? 'like') : null}
      counts={counts}
      total={ready ? counts.reduce((sum, r) => sum + r.total, 0) : fallbackCount}
      ready={ready}
      disabled={!userId || react.isPending}
      onChoose={(next) => react.mutate(next)}
    />
  )
}

/** Everyone's reactions and the member's own on a page of replies, loaded in one go. */
export interface ReplyReactions {
  counts: Map<string, ReactionCount[]>
  mine: Map<string, { id: string; value: number; reaction: string | null }>
}

export async function loadReplyReactions(replyIds: string[], userId: string | null): Promise<ReplyReactions | null> {
  const { data, error } = await sb.rpc('get_reply_reactions', { _reply_ids: replyIds })
  // Before the reactions database update: plain likes only.
  if (error) return null
  const counts = new Map<string, ReactionCount[]>()
  for (const row of (data ?? []) as Array<{ reply_id: string; reaction: string; total: number }>) {
    const list = counts.get(row.reply_id) ?? []
    list.push({ reaction: row.reaction, total: Number(row.total) })
    counts.set(row.reply_id, list)
  }
  for (const list of counts.values()) list.sort((a, b) => b.total - a.total)
  const mine = new Map<string, { id: string; value: number; reaction: string | null }>()
  if (userId) {
    const { data: own } = await sb.from('reply_votes').select('id, reply_id, value, reaction').eq('user_id', userId).in('reply_id', replyIds)
    for (const row of (own ?? []) as Array<{ id: string; reply_id: string; value: number; reaction: string | null }>) {
      mine.set(row.reply_id, row)
    }
  }
  return { counts, mine }
}

/** Save a member's reaction on a reply (null removes it). */
export async function saveReplyReaction(
  replyId: string,
  userId: string,
  existing: { id: string } | undefined,
  next: ReactionId | null,
  ready: boolean,
) {
  if (next === null) {
    if (!existing) return
    const { error } = await sb.from('reply_votes').delete().eq('id', existing.id)
    if (error) throw error
    return
  }
  if (existing) {
    const { error } = await sb.from('reply_votes').update(ready ? { value: 1, reaction: next } : { value: 1 }).eq('id', existing.id)
    if (error) throw error
    return
  }
  const { error } = await sb
    .from('reply_votes')
    .insert({ reply_id: replyId, user_id: userId, value: 1, ...(ready ? { reaction: next } : {}) })
  if (error) throw error
}
