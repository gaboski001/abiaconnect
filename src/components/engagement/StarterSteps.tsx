import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ChevronRight, Circle, Gift, Loader2, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CollapsibleCard } from '@/components/community/CollapsibleCard'
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
 * Where a member is on the first 5 steps: nothing to show, the personalise
 * note, or the steps themselves with the next one and the bonus claim.
 */
function useStarterSteps(poll?: number) {
  const journey = useJourney({ poll })
  const refresh = useRefreshJourney()
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

  // Not personalised yet (members from before the welcome screen existed).
  const state: 'none' | 'personalise' | 'steps' =
    !data || data.bonus_claimed
      ? 'none'
      : !data.onboarded_at
        ? 'personalise'
        : // For the first weeks after joining, or after personalising.
          daysSince(data.created_at) < NEWCOMER_DAYS || daysSince(data.onboarded_at) < NEWCOMER_DAYS
          ? 'steps'
          : 'none'

  const steps = data ? stepList(data, helloLink) : []
  const done = data ? steps.filter((s) => data.steps[s.id]).length : 0
  const next = data ? steps.find((s) => !data.steps[s.id]) : undefined
  return { data, state, steps, done, next, all: done === steps.length && steps.length > 0, claim, claiming, refresh }
}

/**
 * "Your first 5 steps" on the home page: one clear thing to do next, points
 * as you go, and a 50-point bonus plus the New Abian badge at the end. Finished
 * steps drop off the list, and the card goes away once the bonus is claimed.
 */
export function StarterSteps({ compact = false }: { compact?: boolean }) {
  const { data, state, steps, done, next, all, claim, claiming, refresh } = useStarterSteps()

  // Steps are often done on other pages; show where things stand on coming home.
  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data || state === 'none') return null
  if (state === 'personalise') return <PersonaliseNote />

  return (
    <CollapsibleCard
      name="first-steps"
      className={cn('border-primary/25 bg-gradient-to-br from-primary/[0.07] via-card to-card', compact ? 'p-4' : 'p-5')}
      titleClassName="flex-col items-start gap-1"
      title={
        <>
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3.5" /> Your first 5 steps
          </span>
          <span className="text-lg font-semibold leading-snug">
            {all ? 'All done! Claim your bonus' : `${done} of 5 done. Next: ${next?.title.toLowerCase()}`}
          </span>
        </>
      }
      action={
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Gift className="size-3.5" /> +{STARTER_BONUS}
        </span>
      }
    >
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / 5) * 100}%` }} />
      </div>

      {all ? (
        <Button className="mt-4 w-full rounded-full sm:w-auto" disabled={claiming} onClick={() => void claim()}>
          {claiming ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
          Claim {STARTER_BONUS} points and the New Abian badge
        </Button>
      ) : (
        <ol className="mt-4 space-y-1.5">
          {steps
            .filter((step) => !data.steps[step.id])
            .map((step) => {
              const isNext = step === next
              return (
                <li key={step.id}>
                  <Link
                    to={step.to}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                      isNext ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/60',
                    )}
                  >
                    <Circle className={cn('size-5 shrink-0', isNext ? 'text-primary' : 'text-muted-foreground/50')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{step.title}</span>
                      {compact ? null : <span className="block text-xs text-muted-foreground">{step.hint}</span>}
                    </span>
                    {step.points ? <span className="text-xs font-semibold text-amber-600">{step.points}</span> : null}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
        </ol>
      )}
    </CollapsibleCard>
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

/** Pages the steps send people to. */
const STEP_PAGES = /^\/(polls|profile|create-thread|subgroups(\/|$)|thread\/)/

/**
 * A slim "x of 5 done, next: ..." bar on the pages the steps send people to,
 * so a member who has just voted, joined, said hello or added a photo sees it
 * counted and knows where to go next, or can claim the bonus right there.
 */
export function StarterNextBar() {
  const { pathname } = useLocation()
  const onStepPage = STEP_PAGES.test(pathname)
  const { data, state, steps, done, next, all, claim, claiming, refresh } = useStarterSteps(onStepPage ? 8_000 : undefined)

  useEffect(() => {
    if (onStepPage) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Say so when a step has just been done.
  const before = useRef<Journey['steps'] | null>(null)
  useEffect(() => {
    const now = data?.steps
    if (!now) return
    const was = before.current
    before.current = now
    if (!was || state !== 'steps') return
    const finished = steps.find((step) => now[step.id] && !was[step.id])
    if (!finished) return
    toast.success(`Step done: ${finished.title.toLowerCase()} ✓`, {
      description: all ? 'All 5 done. Claim your 50-point bonus.' : next ? `Next: ${next.title.toLowerCase()}` : undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.steps])

  if (!onStepPage || !data || state !== 'steps') return null

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-4 md:px-6 native:px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-3">
        <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-[10rem] flex-1">
          <p className="text-sm font-semibold">
            {all ? 'All 5 steps done!' : `${done} of 5 first steps done`}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / 5) * 100}%` }} />
          </div>
        </div>
        {all ? (
          <Button size="sm" className="rounded-full" disabled={claiming} onClick={() => void claim()}>
            {claiming ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
            Claim {STARTER_BONUS} points
          </Button>
        ) : next ? (
          <Button asChild size="sm" className="rounded-full">
            <Link to={next.to}>
              Next: {next.title} <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
