import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { CalendarClock, ChevronRight, Plus, ShieldCheck, Vote } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { contestPhase, listContests, type ContestPhase, type ContestSummary } from '@/lib/engagement'
import { cn } from '@/lib/utils'

type Tab = 'open' | 'upcoming' | 'results' | 'mine' | 'review'

export const PHASE_STYLE: Record<ContestPhase, { label: string; className: string }> = {
  open: { label: 'Voting open', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  upcoming: { label: 'Upcoming', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  closed: { label: 'Results', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Awaiting approval', className: 'bg-amber-400/15 text-amber-700 dark:text-amber-300' },
  rejected: { label: 'Not approved', className: 'bg-rose-500/15 text-rose-600 dark:text-rose-300' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
}

/** True when the member owns at least one group (so may propose contests). */
export function useOwnsAGroup() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['owns-group', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from('subgroups').select('id', { count: 'exact', head: true }).eq('created_by', user!.id)
      return (count ?? 0) > 0
    },
  })
}

export default function Contests() {
  const { user, isAdmin, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const owns = useOwnsAGroup()
  const q = useQuery({ queryKey: ['contests'], queryFn: listContests, enabled: !!user, refetchInterval: 60_000 })

  if (!loading && !user) return <Navigate to="/login" replace />

  const canCreate = isAdmin || owns.data === true
  const all = q.data ?? []
  const now = Date.now()
  const withPhase = all.map((c) => ({ ...c, phase: contestPhase(c, now) }))
  const lists: Record<Tab, typeof withPhase> = {
    open: withPhase.filter((c) => c.phase === 'open').sort((a, b) => +new Date(a.ends_at) - +new Date(b.ends_at)),
    upcoming: withPhase.filter((c) => c.phase === 'upcoming').sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    results: withPhase.filter((c) => c.phase === 'closed'),
    mine: withPhase.filter((c) => c.created_by === user?.id),
    review: withPhase.filter((c) => c.status === 'pending'),
  }
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'open', label: 'Open' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'results', label: 'Results' },
    ...(canCreate ? [{ id: 'mine' as Tab, label: 'Mine' }] : []),
    ...(isAdmin ? [{ id: 'review' as Tab, label: `Review${lists.review.length ? ` (${lists.review.length})` : ''}` }] : []),
  ]
  const requested = params.get('tab') as Tab | null
  const tab: Tab = requested && tabs.some((t) => t.id === requested) ? requested : 'open'
  const items = lists[tab]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SEO title="Contests & elections" description="Secure community voting for elections, awards and competitions." path="/contests" />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold native:hidden">Contests & elections</h1>
          <p className="text-sm text-muted-foreground">
            Secure, one-person-one-vote voting for your group’s elections, awards and competitions.
          </p>
        </div>
        {canCreate ? (
          <Link
            to="/contests/new"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New
          </Link>
        ) : null}
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none]" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'open' ? {} : { tab: t.id }, { replace: true })}
            className={cn(
              'shrink-0 flex-1 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition-colors',
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState tab={tab} canCreate={canCreate} />
      ) : (
        <ul className="space-y-2.5">
          {items.map((c) => (
            <li key={c.id}>
              <ContestCard c={c} />
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[12px] text-muted-foreground">
        <ShieldCheck className="size-4" /> Secret ballot · one vote per member · results can’t be altered
      </p>
    </div>
  )
}

export function ContestCard({ c }: { c: ContestSummary & { phase: ContestPhase } }) {
  const style = PHASE_STYLE[c.phase]
  const when =
    c.phase === 'open'
      ? `Closes in ${formatDistanceToNowStrict(new Date(c.ends_at))}`
      : c.phase === 'upcoming'
        ? `Opens ${format(new Date(c.starts_at), 'd MMM, h:mm a')}`
        : `Closed ${format(new Date(c.ends_at), 'd MMM yyyy')}`
  return (
    <Link to={`/contests/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 active:bg-muted">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Vote className="size-5 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', style.className)}>{style.label}</span>
        <span className="mt-1 block truncate text-[15px] font-semibold text-foreground">{c.title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
          <CalendarClock className="size-3.5" /> {when}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function EmptyState({ tab, canCreate }: { tab: Tab; canCreate: boolean }) {
  const text: Record<Tab, string> = {
    open: 'No contests are open for voting right now.',
    upcoming: 'No upcoming contests.',
    results: 'No finished contests yet.',
    mine: 'You haven’t created any contests yet.',
    review: 'Nothing is waiting for approval.',
  }
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="text-[14px] text-muted-foreground">{text[tab]}</p>
      {canCreate && (tab === 'open' || tab === 'mine') ? (
        <Link to="/contests/new" className="mt-3 inline-block text-[14px] font-semibold text-primary">
          Create a contest
        </Link>
      ) : null}
    </div>
  )
}
