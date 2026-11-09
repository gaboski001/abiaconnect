import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PartyPopper, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { getBirthdaysToday, lagosDateKey, type BirthdayPerson } from '@/lib/birthday'
import { BirthdayWishDialog } from './BirthdayWishDialog'
import { cn } from '@/lib/utils'

/** Remembers "close" for today only; tomorrow's birthdays show again. */
const hiddenKey = (userId: string) => `abia:birthdays-hidden:${userId}:${lagosDateKey()}`

function readHidden(userId: string | undefined): boolean {
  if (!userId) return false
  try {
    return localStorage.getItem(hiddenKey(userId)) === '1'
  } catch {
    return false
  }
}

/**
 * "Birthdays today" on the home screen: members celebrating today, so everyone
 * can send them wishes. Once a member has wished someone, that person leaves
 * their card; when everyone is wished (or they close it) the card goes away
 * until tomorrow. Fetched rarely (the list only changes once a day).
 */
export function BirthdaysTodayCard({ className }: { className?: string }) {
  const { user } = useAuth()
  const [wishing, setWishing] = useState<BirthdayPerson[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  // Wished in this visit: hidden straight away, before the list reloads.
  const [justWished, setJustWished] = useState<Set<string>>(() => new Set())
  const [closedNow, setClosedNow] = useState(false)
  const q = useQuery({
    queryKey: ['birthdays-today', user?.id],
    queryFn: getBirthdaysToday,
    enabled: !!user,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  })
  const people = (q.data ?? []).filter((p) => !p.wished && !justWished.has(p.id))
  if (!user || closedNow || readHidden(user.id) || people.length === 0) return null
  const shown = showAll ? people : people.slice(0, 4)

  const close = () => {
    setClosedNow(true)
    try {
      localStorage.setItem(hiddenKey(user.id), '1')
    } catch {
      // Private browsing: it still closes for this visit.
    }
  }

  return (
    <section
      aria-label="Birthdays today"
      className={cn('rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-400/10 via-card to-amber-400/10 p-4', className)}
    >
      <div className="flex items-start gap-2">
        <PartyPopper className="mt-0.5 size-5 shrink-0 text-rose-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">
            {people.length === 1 ? 'A birthday today' : `${people.length} birthdays today`}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {people.length === 1 ? 'Make their day special: send your wishes.' : 'Make their day special: wish them one by one, or all at once.'}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close birthdays for today"
          title="Close for today"
          className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
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
            <Button size="sm" variant={people.length > 1 ? 'outline' : 'default'} className="h-9 shrink-0 rounded-full" onClick={() => setWishing([p])}>
              Send wishes
            </Button>
          </li>
        ))}
      </ul>
      {people.length > 4 ? (
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `See all ${people.length}`}
        </Button>
      ) : null}
      {people.length > 1 ? (
        <Button className="mt-3 w-full rounded-full" onClick={() => setWishing(people)}>
          <PartyPopper className="size-4" /> Wish all {people.length}
        </Button>
      ) : null}
      <BirthdayWishDialog
        person={wishing}
        onClose={() => setWishing(null)}
        onSent={(ids) => setJustWished((prev) => new Set([...prev, ...ids]))}
      />
    </section>
  )
}

export default BirthdaysTodayCard
