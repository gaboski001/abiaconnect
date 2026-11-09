import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { getMyBirthdayWishes, isBirthdayToday } from '@/lib/birthday'
import { cn } from '@/lib/utils'

/**
 * The platform's birthday wishes, shown on the member's birthday (Lagos time)
 * on the home screen under "Welcome back" and on the dashboard. The same day
 * they also get the birthday email and notification (daily-birthday-greetings).
 */
export function BirthdayGreeting({ className }: { className?: string }) {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const birthday = !!user && isBirthdayToday(profile?.dob)
  // Wishes from members and the team; checked every few minutes while it's their day.
  const wishes = useQuery({
    queryKey: ['my-birthday-wishes', user?.id],
    queryFn: getMyBirthdayWishes,
    enabled: birthday,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  })
  const [showAll, setShowAll] = useState(false)
  if (!user || !birthday) return null
  const list = wishes.data ?? []
  const shown = showAll ? list : list.slice(0, 3)
  const firstName = (profile?.display_name || profile?.username || '').split(' ')[0]

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      aria-label="Birthday wishes"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/15 via-card to-rose-400/10 p-5',
        className,
      )}
    >
      <span className="pointer-events-none absolute -right-3 -top-4 select-none text-6xl opacity-80" aria-hidden>
        🎉
      </span>
      <div className="relative flex gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-2xl" aria-hidden>
          🎂
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-foreground">Happy birthday{firstName ? `, ${firstName}` : ''}!</p>
          <p className="mt-1 text-[14px] leading-6 text-muted-foreground">
            On behalf of the entire AbiaConnect family, we celebrate you today. Thank you for being part of our community. We
            wish you good health, joy and every success in the year ahead.
          </p>
          <p className="mt-2 text-[13px] font-semibold text-amber-700 dark:text-amber-300">— The AbiaConnect team</p>
        </div>
      </div>
      {list.length > 0 ? (
        <div className="relative mt-4 border-t border-amber-400/30 pt-3">
          <p className="text-[14px] font-bold">
            💌 {list.length} {list.length === 1 ? 'person has' : 'people have'} sent you birthday wishes
          </p>
          <ul className="mt-2 space-y-2">
            {shown.map((w) => (
              <li
                key={w.from_id}
                className={cn('flex gap-2 rounded-xl bg-background/60 p-2', w.from_team && 'ring-1 ring-amber-400/60')}
              >
                {w.from_team ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20" aria-hidden>
                    💚
                  </span>
                ) : (
                  <UserAvatar avatarUrl={w.avatar_url} displayName={w.name} size="sm" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{w.name}</p>
                  <p className="break-words text-[13px] text-muted-foreground">{w.message}</p>
                </div>
              </li>
            ))}
          </ul>
          {list.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-[13px] font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              {showAll ? 'Show fewer' : `Read all ${list.length} wishes`}
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.section>
  )
}

export default BirthdayGreeting
