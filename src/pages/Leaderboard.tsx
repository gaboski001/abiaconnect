import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SEO } from '@/components/SEO'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { LEVELS, getLeaderboard, getMyRank, type LeaderboardPeriod, type LeaderboardRow } from '@/lib/engagement'
import { cn } from '@/lib/utils'

const PERIODS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { user, loading } = useAuth()
  const [chosen, setChosen] = useState<LeaderboardPeriod | null>(null)
  // Open on "This week", but fall back to "All time" while the week is still
  // empty, so the board never looks dead.
  const week = useQuery({ queryKey: ['leaderboard', 'week'], queryFn: () => getLeaderboard('week'), enabled: !!user })
  const period: LeaderboardPeriod = chosen ?? (week.isSuccess && week.data.length === 0 ? 'all' : 'week')
  const setPeriod = setChosen
  const board = useQuery({ queryKey: ['leaderboard', period], queryFn: () => getLeaderboard(period), enabled: !!user && (period !== 'week' || week.isSuccess) })
  const mine = useQuery({ queryKey: ['my-rank', period], queryFn: () => getMyRank(period), enabled: !!user })

  if (!loading && !user) return <Navigate to="/login" replace />
  const rows = board.data ?? []
  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SEO title="Leaderboard" description="The most active members of the AbiaConnect community." path="/leaderboard" />
      <header className="native:hidden">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Celebrating the members who keep our community alive.</p>
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              'rounded-full py-2 text-[13px] font-semibold transition-colors',
              period === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {mine.data ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          <span className="text-[14px] font-semibold text-foreground">Your rank</span>
          <span className="text-[14px] text-foreground">
            {mine.data.rank ? (
              <>
                <span className="font-extrabold">#{mine.data.rank}</span> · {mine.data.points.toLocaleString()} pts
              </>
            ) : (
              'Take part to get on the board'
            )}
          </span>
        </div>
      ) : null}

      {board.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[14px] text-muted-foreground">
          No points earned in this period yet. Start a discussion to lead the board!
        </div>
      ) : (
        <>
          <section className="grid grid-cols-3 items-end gap-2">
            {[podium[1], podium[0], podium[2]].map((m, i) =>
              m ? <PodiumSpot key={m.user_id} row={m} place={[2, 1, 3][i]} me={m.user_id === user?.id} /> : <div key={i} />,
            )}
          </section>
          {rest.length ? (
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {rest.map((m) => (
                <li key={m.user_id} className={cn('flex items-center gap-3 px-4 py-3', m.user_id === user?.id && 'bg-amber-400/10')}>
                  <span className="w-7 text-center text-[14px] font-bold text-muted-foreground">{m.rank}</span>
                  <UserAvatar avatarUrl={m.avatar_url} displayName={m.display_name || 'Member'} size="sm" className="h-9 w-9 border-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-foreground">{m.display_name || 'Member'}</span>
                    <span className="block text-[12px] text-muted-foreground">{LEVELS[m.level - 1]?.name ?? ''}</span>
                  </span>
                  <span className="text-[14px] font-bold text-foreground">{m.points.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </div>
  )
}

function PodiumSpot({ row, place, me }: { row: LeaderboardRow; place: number; me: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border bg-card px-2 pb-3 text-center',
        place === 1 ? 'border-amber-400/50 pt-4' : 'border-border pt-3',
        me && 'ring-2 ring-amber-400/60',
      )}
    >
      <span className="text-2xl" aria-label={`Place ${place}`}>
        {MEDALS[place - 1]}
      </span>
      <UserAvatar
        avatarUrl={row.avatar_url}
        displayName={row.display_name || 'Member'}
        size="md"
        className={cn('mt-1 border-0', place === 1 ? 'h-16 w-16' : 'h-12 w-12')}
      />
      <p className="mt-2 line-clamp-1 w-full text-[13px] font-semibold text-foreground">{row.display_name || 'Member'}</p>
      <p className="text-[13px] font-extrabold text-amber-600 dark:text-amber-300">{row.points.toLocaleString()}</p>
    </div>
  )
}
