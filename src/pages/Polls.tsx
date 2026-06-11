import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('poll-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => {
        qc.invalidateQueries({ queryKey: ['polls'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [qc])

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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Vote className="size-7 text-primary" /> Community Polls
          </h1>
          <p className="text-muted-foreground mt-1">
            Vote on issues that matter to the AbiaConnect community.
          </p>
        </div>
        {canCreate && <CreatePollDialog onCreated={() => pollsQ.refetch()} />}
      </header>

      {pollsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading polls…</p>
      ) : polls.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">No active polls right now.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
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

/* -------------------- Poll Card -------------------- */
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
    <article className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-bold text-lg">{poll.question}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {poll.creator?.display_name ? `By ${poll.creator.display_name} · ` : ''}
          {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}
        </p>
        {poll.expires_at && (
          <span
            className={cn(
              'inline-block mt-2 rounded-full px-2 py-0.5 text-xs font-medium',
              closed
                ? 'bg-muted text-muted-foreground'
                : 'bg-secondary/20 text-secondary-foreground',
            )}
          >
            {closed
              ? 'Closed'
              : `Closes ${formatDistanceToNow(new Date(poll.expires_at), { addSuffix: true })}`}
          </span>
        )}
      </div>

      <ul className="space-y-2">
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
                  'relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors',
                  canClick
                    ? 'border-border hover:border-primary cursor-pointer'
                    : 'border-border cursor-default',
                  selected && 'border-primary',
                )}
              >
                {showResults && (
                  <motion.span
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute inset-y-0 left-0 bg-primary/10"
                    aria-hidden
                  />
                )}
                <span className="relative flex items-center justify-between gap-3 text-sm font-medium">
                  <span className="flex items-center gap-2 truncate">
                    {selected && <Check className="size-4 text-primary shrink-0" />}
                    {opt.text}
                  </span>
                  {showResults && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {pct}% · {count}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
        <span>{total} {total === 1 ? 'vote' : 'votes'}</span>
        {!isLoggedIn && !closed && <span>Sign in to vote</span>}
      </div>
    </article>
  )
}

/* -------------------- Create Poll Dialog -------------------- */
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
        <Button><Plus /> Create Poll</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
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
                <Plus /> Add option
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
                  <CalendarIcon />
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
                  className="p-3 pointer-events-auto"
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
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting ? 'Creating…' : 'Create Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
