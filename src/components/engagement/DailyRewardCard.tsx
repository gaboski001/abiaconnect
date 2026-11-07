import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Flame, Gift } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { claimDailyReward, engagementErrorText, getMyRewards, levelFor } from '@/lib/engagement'
import { toast } from '@/lib/toast'
import { GOLD_GRADIENT } from '@/lib/mobileBrand'

export const MY_REWARDS_KEY = ['my-rewards']

/**
 * Daily check-in + level progress. One tap a day; the streak grows the reward,
 * which is what brings members back every day. Goes away for the day once
 * claimed; the rewards page keeps it, with the level progress.
 */
export function DailyRewardCard({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [celebrate, setCelebrate] = useState<number | null>(null)

  const q = useQuery({ queryKey: MY_REWARDS_KEY, queryFn: getMyRewards, enabled: !!user, staleTime: 30_000 })

  const claim = useMutation({
    mutationFn: claimDailyReward,
    onSuccess: (r) => {
      if (r.claimed) {
        setCelebrate(r.earned)
        window.setTimeout(() => setCelebrate(null), 2200)
        if (r.bonus) toast.success(`Streak bonus! +${r.bonus} points for ${r.streak} days in a row`)
      }
      void qc.invalidateQueries({ queryKey: MY_REWARDS_KEY })
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })

  if (!user) return null
  if (q.isLoading || !q.data) return <div className="h-[132px] animate-pulse rounded-2xl bg-muted" />

  const r = q.data
  if (r.claimed_today && celebrate == null && !alwaysShow) return null
  const { current, next, progress } = levelFor(r.points)
  const streak = r.current_streak
  const nextReward = 10 + Math.min(streak, 6) * 2

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-card p-4">
      <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-amber-400/10 blur-2xl" aria-hidden />
      <div className="relative flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-2xl" aria-hidden>
          {r.claimed_today ? '🔥' : '🎁'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-foreground">
            {r.claimed_today ? `${streak}-day streak` : 'Your daily reward is ready'}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {r.claimed_today ? 'Come back tomorrow to keep it going.' : `Check in to earn +${nextReward} points.`}
          </p>
        </div>
        {r.claimed_today ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1.5 text-[13px] font-bold text-amber-600 dark:text-amber-300">
            <Flame className="size-4" /> {streak}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => claim.mutate()}
            disabled={claim.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[14px] font-bold text-[#0B1F0B] active:scale-95 disabled:opacity-70"
            style={{ backgroundImage: GOLD_GRADIENT }}
          >
            <Gift className="size-4" /> {claim.isPending ? 'Claiming…' : 'Claim'}
          </button>
        )}
      </div>

      <Link to="/rewards" className="relative mt-4 block">
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">Level {current.level} · {current.name}</span> · {r.points.toLocaleString()} pts
          </span>
          <span className="inline-flex items-center">
            {next ? `${(next.min - r.points).toLocaleString()} to ${next.name}` : 'Top level'}
            <ChevronRight className="size-4" />
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundImage: GOLD_GRADIENT }}
            initial={false}
            animate={{ width: `${Math.max(4, progress * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </Link>

      <AnimatePresence>
        {celebrate != null ? (
          <motion.div
            key="celebrate"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 flex items-center justify-center bg-card/90 backdrop-blur-sm"
            aria-live="polite"
          >
            <span className="text-3xl font-black text-amber-500 dark:text-amber-300">+{celebrate} points 🎉</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

export default DailyRewardCard
