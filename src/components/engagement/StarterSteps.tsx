import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Circle, Gift, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  NEWCOMER_DAYS,
  STARTER_BONUS,
  claimStarterBonus,
  daysSince,
  helloPath,
  loadTopics,
  loadWelcomeThread,
  needsWelcome,
  useJourney,
  useRefreshJourney,
  type Journey,
  type StepId,
} from '@/lib/journey'
import { cn } from '@/lib/utils'

const HIDE_KEY = 'abia.starter-hidden'
const NOTE_KEY = 'abia.personalise-note-hidden'

function stored(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function store(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Fine.
  }
}

/** Sends a brand-new member to the welcome screen once, on their first visit home. */
export function useWelcomeRedirect() {
  const journey = useJourney()
  const navigate = useNavigate()
  useEffect(() => {
    if (needsWelcome(journey.data)) navigate('/welcome', { replace: true })
  }, [journey.data, navigate])
}

function stepList(journey: Journey, helloLink: string) {
  const groupLink = journey.lga_group ? `/subgroups/${journey.lga_group}` : '/subgroups'
  const items: { id: StepId; title: string; hint: string; to: string; points?: string }[] = [
    { id: 'interests', title: 'Tell us what you like', hint: 'So we can show you the right groups.', to: '/welcome' },
    { id: 'group', title: 'Join your LGA group', hint: 'Your people, at home and abroad.', to: groupLink },
    { id: 'vote', title: 'Vote in a poll', hint: 'One tap. See what Abians think.', to: '/polls', points: '+2' },
    { id: 'hello', title: 'Say hello', hint: 'Reply on your LGA welcome thread: your name, town and what you do.', to: helloLink, points: '+5' },
    { id: 'photo', title: 'Add a profile photo', hint: 'People reply more to a friendly face.', to: '/profile' },
  ]
  return items
}

/**
 * "Your first 5 steps" on the home page: one clear thing to do next, points
 * as you go, and a 50-point bonus plus the New Abian badge at the end.
 */
export function StarterSteps({ compact = false }: { compact?: boolean }) {
  const journey = useJourney()
  const refresh = useRefreshJourney()
  const [hidden, setHidden] = useState(() => stored(HIDE_KEY))
  const [claiming, setClaiming] = useState(false)
  const [helloLink, setHelloLink] = useState('/create-thread')

  const data = journey.data
  useEffect(() => {
    const group = data?.lga_group
    if (!group) return
    // Introductions go on the group's welcome thread, not in a new thread.
    void loadWelcomeThread(group).then(async (welcome) => {
      if (welcome) return setHelloLink(helloPath(welcome))
      const intro = (await loadTopics(group)).find((t) => t.name === 'Introduce yourself')
      setHelloLink(`/subgroups/${group}${intro ? `?topic=${intro.id}` : ''}`)
    })
  }, [data?.lga_group])

  if (!data || hidden) return null
  // Not personalised yet (members from before the welcome screen existed).
  if (!data.onboarded_at) return <PersonaliseNote />
  // For the first weeks after joining, or after personalising.
  const recent = daysSince(data.created_at) < NEWCOMER_DAYS || daysSince(data.onboarded_at) < NEWCOMER_DAYS
  if (!recent) return null

  const steps = stepList(data, helloLink)
  const done = steps.filter((s) => data.steps[s.id]).length
  const next = steps.find((s) => !data.steps[s.id])
  const all = done === steps.length

  async function claim() {
    setClaiming(true)
    try {
      const points = await claimStarterBonus()
      toast.success(points > 0 ? `🎉 +${points} points and the New Abian badge! Welcome to the family.` : 'Your bonus is already in your rewards.')
      await refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (data.bonus_claimed) {
    return (
      <section className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <span className="text-3xl" aria-hidden>🏅</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">You're a New Abian!</p>
          <p className="text-sm text-muted-foreground">All 5 steps done. Keep checking in daily to grow your streak.</p>
        </div>
        <button
          type="button"
          aria-label="Hide"
          onClick={() => {
            store(HIDE_KEY)
            setHidden(true)
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </section>
    )
  }

  return (
    <section className={cn('rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5', compact && 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3.5" /> Your first 5 steps
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {all ? 'All done! Claim your bonus' : `${done} of 5 done. Next: ${next?.title.toLowerCase()}`}
          </h2>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Gift className="size-3.5" /> +{STARTER_BONUS}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / 5) * 100}%` }} />
      </div>

      {all ? (
        <Button className="mt-4 w-full rounded-full sm:w-auto" disabled={claiming} onClick={() => void claim()}>
          {claiming ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
          Claim {STARTER_BONUS} points and the New Abian badge
        </Button>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {steps.map((step) => {
            const finished = data.steps[step.id]
            const isNext = step === next
            return (
              <li key={step.id}>
                <Link
                  to={step.to}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                    isNext ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/60',
                    finished && 'pointer-events-none',
                  )}
                  aria-disabled={finished}
                >
                  {finished ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className={cn('size-5 shrink-0', isNext ? 'text-primary' : 'text-muted-foreground/50')} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-medium', finished && 'text-muted-foreground line-through')}>{step.title}</span>
                    {!finished && !compact ? <span className="block text-xs text-muted-foreground">{step.hint}</span> : null}
                  </span>
                  {step.points && !finished ? <span className="text-xs font-semibold text-amber-600">{step.points}</span> : null}
                  {!finished ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** For members who joined before the welcome screen existed. */
function PersonaliseNote() {
  const [hidden, setHidden] = useState(() => stored(NOTE_KEY))
  if (hidden) return null
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
      <span className="text-2xl" aria-hidden>✨</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">New: groups for all 17 LGAs, with topics inside</p>
        <p className="text-sm text-muted-foreground">Pick your interests and join your LGA group in under a minute. Earn a 50-point bonus.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="rounded-full">
          <Link to="/welcome">Personalise</Link>
        </Button>
        <button
          type="button"
          aria-label="Hide"
          onClick={() => {
            store(NOTE_KEY)
            setHidden(true)
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </section>
  )
}
