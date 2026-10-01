import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ChevronRight, Lock, Trophy } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { useAuth } from '@/contexts/AuthContext'
import { DailyRewardCard, MY_REWARDS_KEY } from '@/components/engagement/DailyRewardCard'
import { BADGE_ORDER, BADGES, EARNING_RULES, LEVELS, REASON_LABELS, getMyRewards, levelFor } from '@/lib/engagement'
import { cn } from '@/lib/utils'

export default function Rewards() {
  const { user, loading } = useAuth()
  const q = useQuery({ queryKey: MY_REWARDS_KEY, queryFn: getMyRewards, enabled: !!user })

  if (!loading && !user) return <Navigate to="/login" replace />
  const r = q.data
  const earned = new Set((r?.badges ?? []).map((b) => b.badge))
  const lvl = r ? levelFor(r.points) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SEO title="My rewards" description="Your AbiaConnect points, level, streak and badges." path="/rewards" />
      <header className="native:hidden">
        <h1 className="text-2xl font-bold">My rewards</h1>
        <p className="text-sm text-muted-foreground">Earn points by taking part. Level up and collect badges.</p>
      </header>

      <DailyRewardCard />

      {r && lvl ? (
        <section className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Points', value: r.points.toLocaleString() },
            { label: 'Level', value: `${lvl.current.level}` },
            { label: 'Best streak', value: `${r.longest_streak} ${r.longest_streak === 1 ? 'day' : 'days'}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
              <p className="text-[20px] font-extrabold text-foreground">{s.value}</p>
              <p className="text-[12px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>
      ) : null}

      <Link
        to="/leaderboard"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 active:bg-muted"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/15">
          <Trophy className="size-5 text-amber-600 dark:text-amber-300" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-foreground">Leaderboard</span>
          <span className="block text-[13px] text-muted-foreground">See this week’s most active members</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <section>
        <h2 className="mb-3 text-[18px] font-bold">Badges</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {BADGE_ORDER.map((key) => {
            const b = BADGES[key]
            const has = earned.has(key)
            return (
              <div
                key={key}
                className={cn(
                  'rounded-2xl border p-3 text-center',
                  has ? 'border-amber-400/40 bg-amber-400/10' : 'border-border bg-card opacity-60',
                )}
              >
                <div className="text-3xl" aria-hidden>
                  {has ? b.emoji : <Lock className="mx-auto size-7 text-muted-foreground" />}
                </div>
                <p className="mt-1.5 text-[13px] font-semibold text-foreground">{b.name}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">{b.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-bold">How to earn points</h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {EARNING_RULES.map((rule) => (
            <div key={rule.reason} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">
                <span className="block text-[14px] font-medium text-foreground">{rule.label}</span>
                {rule.cap ? <span className="block text-[12px] text-muted-foreground">{rule.cap}</span> : null}
              </span>
              <span className="text-[14px] font-bold text-amber-600 dark:text-amber-300">{rule.points}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[18px] font-bold">Levels</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEVELS.map((l) => (
            <div
              key={l.level}
              className={cn(
                'rounded-xl border px-3 py-2',
                lvl?.current.level === l.level ? 'border-amber-400/60 bg-amber-400/10' : 'border-border bg-card',
              )}
            >
              <p className="text-[13px] font-semibold text-foreground">
                {l.level}. {l.name}
              </p>
              <p className="text-[12px] text-muted-foreground">{l.min.toLocaleString()}+ points</p>
            </div>
          ))}
        </div>
      </section>

      {r?.recent?.length ? (
        <section>
          <h2 className="mb-3 text-[18px] font-bold">Recent points</h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {r.recent.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-[14px] text-foreground">{REASON_LABELS[e.reason] ?? e.reason}</span>
                <span className="text-[12px] text-muted-foreground">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </span>
                <span className={cn('w-12 text-right text-[14px] font-bold', e.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                  {e.amount > 0 ? `+${e.amount}` : e.amount}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="pb-2 text-center text-[12px] text-muted-foreground">
        Points celebrate your contribution to the community. They have no cash value.
      </p>
    </div>
  )
}
