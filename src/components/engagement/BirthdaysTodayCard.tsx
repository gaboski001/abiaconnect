import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Check, PartyPopper } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { getBirthdaysToday, type BirthdayPerson } from '@/lib/birthday'
import { BirthdayWishDialog } from './BirthdayWishDialog'
import { cn } from '@/lib/utils'

/**
 * "Birthdays today" on the home screen: members celebrating today, so everyone
 * can send them wishes. Hidden when nobody is celebrating. Fetched rarely
 * (the list only changes once a day) to keep the home screen light.
 */
export function BirthdaysTodayCard({ className }: { className?: string }) {
  const { user } = useAuth()
  const [wishing, setWishing] = useState<BirthdayPerson | null>(null)
  const [showAll, setShowAll] = useState(false)
  const q = useQuery({
    queryKey: ['birthdays-today', user?.id],
    queryFn: getBirthdaysToday,
    enabled: !!user,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })
  const people = q.data ?? []
  if (!user || people.length === 0) return null
  const shown = showAll ? people : people.slice(0, 4)

  return (
    <section
      aria-label="Birthdays today"
      className={cn('rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-400/10 via-card to-amber-400/10 p-4', className)}
    >
      <div className="flex items-center gap-2">
        <PartyPopper className="size-5 text-rose-500" aria-hidden />
        <h2 className="text-[15px] font-bold">
          {people.length === 1 ? 'A birthday today' : `${people.length} birthdays today`}
        </h2>
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Make their day special: send them your wishes.</p>
      <ul className="mt-3 space-y-2">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Link to={`/member/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar avatarUrl={p.avatar_url} displayName={p.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">🎂 {p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.wishes === 0 ? 'Be the first to wish them' : `${p.wishes} ${p.wishes === 1 ? 'wish' : 'wishes'} so far`}
                </span>
              </span>
            </Link>
            {p.wished ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> Wished
              </span>
            ) : (
              <Button size="sm" className="h-9 shrink-0 rounded-full" onClick={() => setWishing(p)}>
                Send wishes
              </Button>
            )}
          </li>
        ))}
      </ul>
      {people.length > 4 ? (
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `See all ${people.length}`}
        </Button>
      ) : null}
      <BirthdayWishDialog person={wishing} onClose={() => setWishing(null)} />
    </section>
  )
}

export default BirthdaysTodayCard
