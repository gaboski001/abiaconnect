import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { isBirthdayToday } from '@/lib/birthday'
import { cn } from '@/lib/utils'

/**
 * The platform's birthday wishes, shown on the member's birthday (Lagos time)
 * on the home screen under "Welcome back" and on the dashboard. The same day
 * they also get the birthday email and notification (daily-birthday-greetings).
 */
export function BirthdayGreeting({ className }: { className?: string }) {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  if (!user || !isBirthdayToday(profile?.dob)) return null
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
    </motion.section>
  )
}

export default BirthdayGreeting
