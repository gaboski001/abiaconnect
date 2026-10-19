import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Check, Loader2, Vote } from 'lucide-react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRefreshJourney } from '@/lib/journey'
import { cn } from '@/lib/utils'

interface QuickPoll {
  id: string
  question: string
  options: { id: string; text: string; votes: number }[]
  total: number
  myChoice: string | null
}

/**
 * The newest poll the member hasn't voted in, voted on with one tap right on
 * the home page. Once they've voted on everything it shows the latest results.
 */
async function loadQuickPoll(userId: string): Promise<QuickPoll | null> {
  const now = new Date().toISOString()
  const { data: polls, error } = await supabase
    .from('polls')
    .select('id, question, expires_at')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  if (!polls?.length) return null
  const ids = polls.map((p) => p.id)
  const { data: mine } = await supabase.from('poll_votes').select('poll_id, poll_option_id').eq('user_id', userId).in('poll_id', ids)
  const voted = new Map((mine ?? []).map((v) => [v.poll_id, v.poll_option_id]))
  const poll = polls.find((p) => !voted.has(p.id)) ?? polls[0]
  const [{ data: options }, { data: counts }] = await Promise.all([
    supabase.from('poll_options').select('id, text, created_at').eq('poll_id', poll.id).order('created_at'),
    supabase.rpc('get_poll_counts', { _poll_ids: [poll.id] }),
  ])
  const countOf = new Map(
    ((counts ?? []) as Array<{ poll_option_id: string; vote_count: number }>).map((c) => [c.poll_option_id, Number(c.vote_count) || 0]),
  )
  const list = (options ?? []).map((o) => ({ id: o.id, text: o.text, votes: countOf.get(o.id) ?? 0 }))
  return {
    id: poll.id,
    question: poll.question,
    options: list,
    total: list.reduce((sum, o) => sum + o.votes, 0),
    myChoice: voted.get(poll.id) ?? null,
  }
}

export function QuickPollCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const refreshJourney = useRefreshJourney()
  const pollQ = useQuery({
    queryKey: ['quick-poll', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => loadQuickPoll(user!.id),
  })
  const vote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, poll_option_id: optionId, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Thanks for voting! Here’s what others think.')
      qc.invalidateQueries({ queryKey: ['quick-poll'] })
      qc.invalidateQueries({ queryKey: ['polls'] })
      qc.invalidateQueries({ queryKey: ['my-poll-votes'] })
      refreshJourney()
    },
    onError: () => toast.error('Your vote didn’t go through. Please try again.'),
  })

  const poll = pollQ.data
  if (!user || !poll || poll.options.length < 2) return null
  const showResults = !!poll.myChoice

  return (
    <section className={cn('rounded-2xl border border-border bg-card', compact ? 'p-4' : 'p-5')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Vote className="size-4 text-primary" /> Have your say
        </h3>
        <Link to="/polls" className="text-sm font-medium text-primary hover:underline">
          All polls
        </Link>
      </div>
      <p className="font-medium leading-snug text-foreground">{poll.question}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {showResults ? `${poll.total.toLocaleString()} ${poll.total === 1 ? 'vote' : 'votes'} so far` : 'One tap to vote. You’ll see the results straight away.'}
      </p>
      <ul className="mt-3 space-y-2">
        {poll.options.map((o) => {
          const share = poll.total ? Math.round((o.votes / poll.total) * 100) : 0
          const mine = poll.myChoice === o.id
          return (
            <li key={o.id}>
              {showResults ? (
                <div className="relative overflow-hidden rounded-xl border border-border px-3 py-2 text-sm">
                  <div className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${share}%` }} aria-hidden />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className={cn('flex items-center gap-1.5', mine && 'font-semibold text-foreground')}>
                      {mine ? <Check className="size-3.5 shrink-0 text-primary" aria-label="Your vote" /> : null}
                      {o.text}
                    </span>
                    <span className="shrink-0 font-medium text-muted-foreground">{share}%</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={vote.isPending}
                  onClick={() => vote.mutate({ pollId: poll.id, optionId: o.id })}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60"
                >
                  {o.text}
                  {vote.isPending && vote.variables?.optionId === o.id ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
