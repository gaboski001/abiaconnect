import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, Vote } from 'lucide-react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRefreshJourney } from '@/lib/journey'
import { CollapsibleCard } from '@/components/community/CollapsibleCard'
import { MY_REWARDS_KEY } from './DailyRewardCard'
import { cn } from '@/lib/utils'

interface QuickPoll {
  id: string
  question: string
  options: { id: string; text: string }[]
}

/**
 * The newest poll the member hasn't voted in, voted on with one tap right on
 * the home page. Once they've voted on everything the card goes away, until a
 * new poll is created. Results stay on the polls page.
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
  const { data: mine } = await supabase.from('poll_votes').select('poll_id').eq('user_id', userId).in('poll_id', ids)
  const voted = new Set((mine ?? []).map((v) => v.poll_id))
  const poll = polls.find((p) => !voted.has(p.id))
  if (!poll) return null
  const { data: options } = await supabase.from('poll_options').select('id, text, created_at').eq('poll_id', poll.id).order('created_at')
  return { id: poll.id, question: poll.question, options: options ?? [] }
}

export function QuickPollCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const refreshJourney = useRefreshJourney()
  const pollQ = useQuery({
    queryKey: ['quick-poll', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    refetchOnMount: 'always',
    queryFn: () => loadQuickPoll(user!.id),
  })
  const vote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, poll_option_id: optionId, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Thanks for voting! See the results in All polls.')
      qc.invalidateQueries({ queryKey: ['quick-poll'] })
      qc.invalidateQueries({ queryKey: ['polls'] })
      qc.invalidateQueries({ queryKey: ['my-poll-votes'] })
      qc.invalidateQueries({ queryKey: MY_REWARDS_KEY })
      refreshJourney()
    },
    onError: () => toast.error('Your vote didn’t go through. Please try again.'),
  })

  const poll = pollQ.data
  if (!user || !poll || poll.options.length < 2) return null

  return (
    <CollapsibleCard
      name="poll"
      version={poll.id}
      className={compact ? 'p-4' : 'p-5'}
      title={
        <>
          <Vote className="size-4 text-primary" /> Have your say
        </>
      }
      action={
        <Link to="/polls" className="shrink-0 text-sm font-medium text-primary hover:underline">
          All polls
        </Link>
      }
    >
      <p className="font-medium leading-snug text-foreground">{poll.question}</p>
      <p className="mt-1 text-xs text-muted-foreground">One tap to vote.</p>
      <ul className="mt-3 space-y-2">
        {poll.options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              disabled={vote.isPending}
              onClick={() => vote.mutate({ pollId: poll.id, optionId: o.id })}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
            >
              {o.text}
              {vote.isPending && vote.variables?.optionId === o.id ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </CollapsibleCard>
  )
}
