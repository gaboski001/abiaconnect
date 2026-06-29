import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { useThrottledCallback } from '@/hooks/useThrottledCallback'
import { SEO } from '@/components/SEO'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { CalendarIcon, Check, Plus, Vote, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

interface PollOption {
  id: string
  poll_id: string
  text: string
  vote_count?: number
}

interface Poll {
  id: string
  question: string
  created_at: string
  expires_at?: string | null
  is_active?: boolean | null
  created_by?: string | null
  total_votes?: number
  options: PollOption[]
  creator?: { display_name?: string | null } | null
}

export default function Polls() {
  const { user, role } = useAuth()
  const qc = useQueryClient()
  const canCreate = role === 'Super Admin' || role === 'Admin' || (role as string) === 'Moderator'

  const pollsQ = useQuery({
    queryKey: ['polls'],
    queryFn: async () => {
      const { data: polls, error } = await supabase
        .from('polls')
        .select('*, profiles:created_by(display_name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      const list = (polls ?? []) as Array<Poll & { profiles?: Poll['creator'] }>
      if (!list.length) return [] as Poll[]

      const ids = list.map((p) => p.id)
      const [{ data: opts }, { data: counts }] = await Promise.all([
        supabase.from('poll_options').select('*').in('poll_id', ids),
        supabase.rpc('get_poll_counts', { _poll_ids: ids }),
      ])

      const optsByPoll = new Map<string, PollOption[]>()
      for (const o of (opts ?? []) as PollOption[]) {
        const arr = optsByPoll.get(o.poll_id) ?? []
        arr.push({ ...o, vote_count: 0 })
        optsByPoll.set(o.poll_id, arr)
      }
      for (const c of (counts ?? []) as Array<{ poll_id: string; poll_option_id: string; vote_count: number }>) {
        const arr = optsByPoll.get(c.poll_id)
        const opt = arr?.find((o) => o.id === c.poll_option_id)
        if (opt) opt.vote_count = Number(c.vote_count) || 0
      }

      return list.map((p) => {
        const options = optsByPoll.get(p.id) ?? []
        return {
          ...p,
          creator: p.profiles ?? null,
          options,
          total_votes: options.reduce((s, o) => s + (o.vote_count ?? 0), 0),
        }
      })
    },
  })

  const myVotesQ = useQuery({
    queryKey: ['my-poll-votes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poll_votes')
        .select('poll_id, poll_option_id')
        .eq('user_id', user!.id)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const v of (data ?? []) as Array<{ poll_id: string; poll_option_id: string }>) {
        map[v.poll_id] = v.poll_option_id
      }
      return map
    },
  })

  const invalidatePolls = useThrottledCallback(() => {
    qc.invalidateQueries({ queryKey: ['polls'] })
  }, 800)

  useRealtimeChannel({
    channelName: 'poll-votes',
    subscriptions: [
      {
        filter: { event: '*', schema: 'public', table: 'poll_votes' },
        handler: () => invalidatePolls(),
      },
    ],
  })

  const vote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      if (!user) throw new Error('Sign in to vote')
      const { error } = await supabase
        .from('poll_votes')
        .insert({ poll_id: pollId, poll_option_id: optionId, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['polls'] })
      qc.invalidateQueries({ queryKey: ['my-poll-votes'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Vote failed'),
  })

  const polls = pollsQ.data ?? []
  const openPolls = polls.filter((poll) => !poll.expires_at || new Date(poll.expires_at) > new Date()).length
  const totalVotes = polls.reduce((sum, poll) => sum + (poll.total_votes ?? 0), 0)

  return (
    <div className="space-y-6">
      <SEO title="Community Polls" description="Vote on issues that matter to the AbiaConnect community." path="/polls" />

      <section
        className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/96 p-5 text-slate-950 sm:p-6 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
        style={{ boxShadow: PREMIUM_SHADOW }}
      >
        <div className="absolute inset-0 opacity-80 dark:opacity-100" style={{ background: 'radial-gradient(circle at top right, rgba(248,195,1,0.18), transparent 32%), radial-gradient(circle at bottom left, rgba(28,169,217,0.16), transparent 36%)' }} />
        <div className="relative space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/80"
                style={{ background: GOLD_GRADIENT_SOFT }}
              >
                <Vote className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                Community voice
              </div>
              <h1 className="mt-3 flex items-center gap-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                <Vote className="size-7" style={{ color: MOBILE_BRAND.gold }} /> Community Polls
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700 dark:text-slate-300/76">
                Vote on issues that matter to the AbiaConnect community through a cleaner, more professional polling experience with stronger readability and clearer results.
              </p>
            </div>
            {canCreate && <CreatePollDialog onCreated={() => pollsQ.refetch()} />}
          </header>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoMetric label="Active polls" value={String(polls.length)} />
            <InfoMetric label="Open now" value={String(openPolls)} compact />
            <InfoMetric label="Total votes" value={String(totalVotes)} compact />
          </div>
        </div>
      </section>

      {pollsQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-[1.8rem] bg-slate-100 dark:bg-white/[0.05]" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <div className="rounded-[1.8rem] border border-dashed border-slate-200/80 bg-white/90 px-5 py-16 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300/70">
          No active polls right now.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {polls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              myVote={myVotesQ.data?.[p.id]}
              onVote={(optionId) => vote.mutate({ pollId: p.id, optionId })}
              voting={vote.isPending}
              isLoggedIn={!!user}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PollCard({
  poll,
  myVote,
  onVote,
  voting,
  isLoggedIn,
}: {
  poll: Poll
  myVote?: string
  onVote: (optionId: string) => void
  voting: boolean
  isLoggedIn: boolean
}) {
  const closed = poll.expires_at ? new Date(poll.expires_at) < new Date() : false
  const showResults = !!myVote || closed
  const total = poll.total_votes ?? 0

  return (
    <article
      className="rounded-[1.8rem] border border-slate-200/80 bg-white/96 p-5 text-slate-950 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
      style={{ boxShadow: PREMIUM_SHADOW }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{poll.question}</h3>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {poll.creator?.display_name ? `By ${poll.creator.display_name} · ` : ''}
            {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
          </p>
        </div>
        {poll.expires_at && (
          <span
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
              closed
                ? 'border border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
                : 'text-slate-950',
            )}
            style={closed ? undefined : { backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
          >
            {closed
              ? 'Closed'
              : `Closes ${formatDistanceToNow(new Date(poll.expires_at), { addSuffix: true })}`}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {poll.options.map((opt) => {
          const count = opt.vote_count ?? 0
          const pct = total ? Math.round((count / total) * 100) : 0
          const selected = myVote === opt.id
          const canClick = isLoggedIn && !showResults && !voting

          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onVote(opt.id)}
                className={cn(
                  'relative w-full overflow-hidden rounded-[1.2rem] border px-4 py-3 text-left transition-colors',
                  canClick
                    ? 'border-slate-200/80 bg-slate-50/90 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]'
                    : 'border-slate-200/80 bg-slate-50/90 dark:border-white/10 dark:bg-white/[0.04]',
                  selected && 'ring-2 ring-[rgba(248,195,1,0.45)]',
                )}
              >
                {showResults && (
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 bg-[rgba(248,195,1,0.18)]"
                    aria-hidden
                  />
                )}
                <span className="relative flex items-center justify-between gap-3 text-sm font-medium">
                  <span className="flex items-center gap-2 truncate text-slate-900 dark:text-slate-100">
                    {selected && <Check className="size-4 shrink-0" style={{ color: MOBILE_BRAND.goldWarm }} />}
                    {opt.text}
                  </span>
                  {showResults && (
                    <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300/82">
                      {pct}% · {count}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-300/76">
        <span>{total} {total === 1 ? 'vote' : 'votes'}</span>
        {!isLoggedIn && !closed && <span>Sign in to vote</span>}
      </div>
    </article>
  )
}

function InfoMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/92 p-3.5 dark:border-white/10 dark:bg-white/[0.05]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300/62">{label}</p>
      <p className={`mt-2 font-black text-slate-950 dark:text-white ${compact ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>{value}</p>
    </div>
  )
}

function CreatePollDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [expires, setExpires] = useState<Date | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setQuestion('')
    setOptions(['', ''])
    setExpires(undefined)
  }

  const valid = useMemo(() => {
    const validOpts = options.map((o) => o.trim()).filter(Boolean)
    return question.trim().length >= 5 && validOpts.length >= 2
  }, [question, options])

  const submit = async () => {
    if (!user || !valid) return
    setSubmitting(true)
    try {
      const { data: poll, error } = await supabase
        .from('polls')
        .insert({
          question: question.trim(),
          created_by: user.id,
          is_active: true,
          expires_at: expires ? expires.toISOString() : null,
        })
        .select('id')
        .single()
      if (error) throw error
      const pollId = (poll as { id: string }).id
      const rows = options
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ poll_id: pollId, text }))
      const { error: optErr } = await supabase.from('poll_options').insert(rows)
      if (optErr) throw optErr
      toast.success('Poll created')
      setOpen(false)
      reset()
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create poll')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-12 rounded-2xl border-0 px-5 font-bold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
          <Plus className="mr-2 size-4" /> Create Poll
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[1.8rem] border-slate-200/80 bg-white/98 dark:border-white/10 dark:bg-[rgba(8,14,26,0.98)]">
        <DialogHeader>
          <DialogTitle>New Poll</DialogTitle>
          <DialogDescription>Ask the community a question.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Question</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
              placeholder="What should we discuss?"
            />
          </div>

          <div className="space-y-2">
            <Label>Options ({options.length}/8)</Label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                  }
                  placeholder={`Option ${i + 1}`}
                  maxLength={120}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove option"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions((prev) => [...prev, ''])}
              >
                <Plus className="mr-2 size-4" /> Add option
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Closes on (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !expires && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {expires ? format(expires, 'PPP') : 'No expiry'}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expires}
                  onSelect={setExpires}
                  disabled={(d) => d < new Date()}
                  initialFocus
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
            {expires && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpires(undefined)}>
                Clear date
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || submitting} className="border-0 text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
            {submitting ? 'Creating…' : 'Create Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
