import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, Loader2, MapPin, PartyPopper, Users } from 'lucide-react'
import { toast } from 'sonner'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { useProfile } from '@/hooks/useProfile'
import {
  INTERESTS,
  STARTER_BONUS,
  completeWelcome,
  helloPath,
  loadGroups,
  loadTopics,
  loadWelcomeThread,
  suggestGroups,
  useJourney,
  useRefreshJourney,
} from '@/lib/journey'
import { cn } from '@/lib/utils'

/**
 * The first screen after a new member's first sign-in: pick interests, join
 * their people (their LGA group and a few matching groups), and get one clear
 * first thing to do. About a minute, and it can be skipped.
 */
export default function Welcome() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const journey = useJourney()
  const refresh = useRefreshJourney()
  const groups = useQuery({ queryKey: ['welcome-groups'], queryFn: loadGroups, staleTime: 5 * 60_000 })
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [interests, setInterests] = useState<string[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [introTopic, setIntroTopic] = useState<string | null>(null)
  const [welcomeThread, setWelcomeThread] = useState<string | null>(null)

  const firstName = (profile?.display_name || '').split(' ')[0] || 'friend'
  const lga = journey.data?.lga ?? profile?.lga ?? null
  const lgaGroup = useMemo(
    () => (groups.data ?? []).find((g) => g.kind === 'lga' && g.lga === lga) ?? null,
    [groups.data, lga],
  )
  const lgaGroups = useMemo(() => (groups.data ?? []).filter((g) => g.kind === 'lga'), [groups.data])
  const suggested = useMemo(() => suggestGroups(groups.data ?? [], interests).slice(0, 6), [groups.data, interests])

  // Their own LGA group and the first few matching groups start ticked.
  useEffect(() => {
    if (step !== 2) return
    setChosen((current) => {
      if (current.size) return current
      const next = new Set<string>()
      if (lgaGroup) next.add(lgaGroup.id)
      suggested.slice(0, 3).forEach((g) => next.add(g.id))
      return next
    })
  }, [step, lgaGroup, suggested])

  useEffect(() => {
    if (journey.data?.interests?.length && !interests.length) setInterests(journey.data.interests)
  }, [journey.data, interests.length])

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  async function finish() {
    setSaving(true)
    try {
      const result = await completeWelcome(interests, [...chosen])
      const home = result.lga_group ?? lgaGroup?.id
      if (home) {
        const [topics, welcome] = await Promise.all([loadTopics(home), loadWelcomeThread(home)])
        setIntroTopic(topics.find((t) => t.name === 'Introduce yourself')?.id ?? null)
        setWelcomeThread(welcome)
      }
      await refresh()
      setStep(3)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function skip() {
    try {
      localStorage.setItem('abia.welcome-skipped', '1')
    } catch {
      // Fine: they'll just be asked again next time.
    }
    navigate('/', { replace: true })
  }

  const homeGroup = lgaGroup ?? lgaGroups.find((g) => chosen.has(g.id)) ?? null
  // Introductions go on the group's welcome thread, so there is one place to meet everyone.
  const helloLink = welcomeThread
    ? helloPath(welcomeThread)
    : homeGroup
      ? `/subgroups/${homeGroup.id}${introTopic ? `?topic=${introTopic}` : ''}`
      : '/create-thread'

  return (
    <div className="mx-auto max-w-2xl py-6 md:py-12">
      <SEO title="Welcome to AbiaConnect" description="Set up AbiaConnect in a minute." path="/welcome" />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={cn('h-1.5 w-10 rounded-full transition-colors', n <= step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
        {step < 3 ? (
          <button type="button" onClick={skip} className="text-sm text-muted-foreground hover:text-foreground">
            Skip for now
          </button>
        ) : null}
      </div>

      {step === 1 ? (
        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Nnọọ! Welcome</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
              Welcome to AbiaConnect, {firstName} 👋🏾
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              The home of Abians everywhere. Let's make it yours in under a minute.
            </p>
          </div>
          <div>
            <h2 className="font-semibold">What would you like to see more of?</h2>
            <p className="text-sm text-muted-foreground">Pick as many as you like. You can change them later.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {INTERESTS.map((interest) => {
                const on = interests.includes(interest.id)
                return (
                  <button
                    key={interest.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setInterests((list) => (on ? list.filter((id) => id !== interest.id) : [...list, interest.id]))
                    }
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all',
                      on
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card hover:border-primary/50',
                    )}
                  >
                    <span aria-hidden>{interest.emoji}</span> {interest.label}
                    {on ? <Check className="size-3.5" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
          <Button size="lg" className="h-12 w-full rounded-full text-base sm:w-auto sm:px-8" disabled={!interests.length} onClick={() => setStep(2)}>
            Next <ArrowRight className="size-4" />
          </Button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Join your people</h1>
            <p className="mt-2 text-muted-foreground">
              Groups are where Abians chat about home, business and life. We've picked a few for you.
            </p>
          </div>

          {groups.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <>
              {lgaGroup ? (
                <GroupChoice
                  highlight
                  badge={`You're from ${lgaGroup.lga}`}
                  group={lgaGroup}
                  on={chosen.has(lgaGroup.id)}
                  onToggle={() => setChosen((set) => toggle(set, lgaGroup.id))}
                />
              ) : lgaGroups.length ? (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <MapPin className="size-4 text-primary" /> Pick an LGA group to follow
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Where you live, or where your family is from.</p>
                  <select
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3"
                    defaultValue=""
                    onChange={(event) => {
                      const id = event.target.value
                      setChosen((set) => {
                        const next = new Set([...set].filter((g) => !lgaGroups.some((l) => l.id === g)))
                        if (id) next.add(id)
                        return next
                      })
                    }}
                  >
                    <option value="">Choose an LGA…</option>
                    {lgaGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.lga}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {suggested.length ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Because you like…</h2>
                  {suggested.map((group) => (
                    <GroupChoice
                      key={group.id}
                      group={group}
                      on={chosen.has(group.id)}
                      onToggle={() => setChosen((set) => toggle(set, group.id))}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="h-12 rounded-full px-8 text-base" disabled={saving} onClick={() => void finish()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
              {chosen.size ? `Join ${chosen.size} group${chosen.size === 1 ? '' : 's'} and continue` : 'Continue'}
            </Button>
            <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6 text-center">
          <PartyPopper className="mx-auto size-12 text-primary" />
          <div>
            <h1 className="text-3xl font-semibold">You're in, {firstName}! 🎉</h1>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Finish your first 5 steps (they're on your home page) to earn{' '}
              <strong className="text-foreground">{STARTER_BONUS} bonus points</strong> and the{' '}
              <strong className="text-foreground">New Abian</strong> badge. Here's the best place to start:
            </p>
          </div>
          <div className="grid gap-3 text-left sm:grid-cols-2">
            <NextAction
              to={helloLink}
              emoji="👋🏾"
              title={homeGroup ? `Say hello to ${homeGroup.lga ?? homeGroup.name}` : 'Say hello to the community'}
              body={welcomeThread ? 'Reply on the welcome post with your name, town and what you do. Your people will welcome you, and it earns points.' : 'Introduce yourself. Your people will welcome you, and it earns points.'}
              primary
            />
            <NextAction to="/polls" emoji="🗳️" title="Vote in a poll" body="One tap, 2 points, and you see what Abians think." />
            <NextAction to="/" emoji="💬" title="See what people are saying" body="The latest discussions from across Abia and abroad." />
            {interests.includes('meet') ? (
              <NextAction to="/relationship" emoji="🤝🏾" title="Meet new people" body="Find friends and connections, safely." />
            ) : (
              <NextAction to="/profile" emoji="📸" title="Add your photo" body="People reply more to a friendly face." />
            )}
          </div>
          <Link to="/" className="inline-block text-sm text-muted-foreground hover:text-foreground">
            Go to my home page
          </Link>
        </section>
      ) : null}
    </div>
  )
}

function GroupChoice({
  group,
  on,
  onToggle,
  badge,
  highlight,
}: {
  group: { name: string; description: string | null; icon: string | null }
  on: boolean
  onToggle: () => void
  badge?: string
  highlight?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        'flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all',
        on ? 'border-primary bg-primary/[0.06]' : 'border-border bg-card hover:border-primary/40',
        highlight && 'ring-1 ring-primary/30',
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl" aria-hidden>
        {group.icon ?? '👥'}
      </span>
      <span className="min-w-0 flex-1">
        {badge ? <span className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{badge}</span> : null}
        <span className="block font-semibold">{group.name}</span>
        {group.description ? <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">{group.description}</span> : null}
      </span>
      <span
        className={cn(
          'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border',
          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
        aria-hidden
      >
        {on ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  )
}

function NextAction({ to, emoji, title, body, primary }: { to: string; emoji: string; title: string; body: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-2xl border p-4 transition-all hover:-translate-y-0.5',
        primary ? 'border-primary bg-primary text-primary-foreground sm:col-span-2' : 'border-border bg-card hover:border-primary/40',
      )}
    >
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <span className="mt-2 block font-semibold">{title}</span>
      <span className={cn('mt-0.5 block text-sm', primary ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{body}</span>
    </Link>
  )
}
