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

const byId = (id: string | null | undefined) => REACTIONS.find((r) => r.id === id) ?? REACTIONS[0]

/** Hold (or hover on a computer) to see the other reactions, tap to like. */
const HOLD_MS = 450

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
  const [open, setOpen] = useState(false)
  const holdTimer = useRef<number | undefined>(undefined)
  const hoverTimer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  const wrap = useRef<HTMLDivElement>(null)

  const countsQ = useQuery({
    queryKey: ['thread-reactions', threadId],
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_thread_reactions', { _thread_id: threadId })
      // Before the reactions database update: plain likes only.
      if (error) return null
      return ((data ?? []) as Array<{ reaction: string; total: number }>).map((r) => ({ ...r, total: Number(r.total) }))
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
      return data as { id: string; value: number; reaction: string | null } | null
    },
  })
  const mine = mineQ.data?.value === 1 ? byId(mineQ.data.reaction) : null

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

  const choose = (id: ReactionId) => {
    setOpen(false)
    react.mutate(mine?.id === id ? null : id)
  }

  // Close the picker when tapping anywhere else.
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

  const counts = countsQ.data ?? []
  const total = ready ? counts.reduce((sum, r) => sum + r.total, 0) : fallbackCount
  const top = counts.slice(0, 3)
  const disabled = !userId || react.isPending

  return (
    <div className="flex items-center gap-2">
      <div
        ref={wrap}
        className="relative"
        onPointerEnter={(e) => {
          // Hovering opens the picker on a computer; phones use a long press.
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
                    'flex size-10 items-center justify-center rounded-full text-[26px] leading-none',
                    mine?.id === r.id && 'bg-muted',
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
          aria-pressed={!!mine}
          aria-haspopup="menu"
          title={!userId ? 'Sign in to react' : ready ? 'Tap to like. Hold for more reactions.' : 'Like'}
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
            react.mutate(mine ? null : 'like')
          }}
          className={cn(
            'inline-flex h-9 select-none items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60',
            '[-webkit-touch-callout:none] [touch-action:manipulation]',
            mine && cn('border-current/30', mine.color),
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            {mine ? mine.emoji : '👍🏾'}
          </span>
          {mine ? mine.label : 'Like'}
        </button>
      </div>

      {total > 0 ? (
        <span className="flex items-center gap-1 text-sm text-muted-foreground" aria-label={`${total} reactions`}>
          <span className="flex -space-x-1" aria-hidden>
            {(ready ? top : [{ reaction: 'like', total }]).map((r) => (
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
