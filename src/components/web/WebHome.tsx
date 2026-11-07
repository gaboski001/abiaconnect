import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, BookOpen, CalendarDays, Eye, MessageCircle, PenSquare, Pin, Trophy, Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { DailyRewardCard } from '@/components/engagement/DailyRewardCard'
import { BirthdayGreeting } from '@/components/engagement/BirthdayGreeting'
import { AddBirthdayPrompt } from '@/components/engagement/AddBirthdayPrompt'
import { StarterSteps, useWelcomeRedirect } from '@/components/engagement/StarterSteps'
import { OnlineMembersPill } from '@/components/engagement/LiveCommunity'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { contestPhase, listContests } from '@/lib/engagement'
import { daysSince, useJourney } from '@/lib/journey'
import { cn } from '@/lib/utils'
import { QuickPollCard } from '@/components/engagement/QuickPollCard'
import { CollapsibleCard } from '@/components/community/CollapsibleCard'
import { QuestionOfTheDayCard } from '@/components/engagement/QuestionOfTheDayCard'
import { WaitingForReplyCard } from '@/components/engagement/WaitingForReplyCard'
import { CommunityFeed } from '@/components/community/CommunityFeed'
import { InviteCard, JoinInTodayCard, LgaOfTheMonthCard, OpportunitiesCard } from '@/components/community/CommunityCards'
import { shownCount } from '@/lib/quietNumbers'

/** Topics shown before "Show all topics". */
const TOPICS_SHOWN = 6

interface Topic {
  id: string
  name: string
  slug: string | null
  description: string | null
  icon: string | null
  color: string | null
  thread_count: number
}

/**
 * Website home: a community portal (welcome, discussion list, topic index and
 * a sidebar). Deliberately different from the app's card-based home.
 */
export function WebHome() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const journey = useJourney()
  useWelcomeRedirect()
  const [allTopics, setAllTopics] = useState(false)
  // A member's first day: welcome them, don't say "welcome back".
  const firstDay = daysSince(journey.data?.created_at) < 1
  const topics = useQuery({
    queryKey: ['categories'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('display_order')
      if (error) throw error
      return (data ?? []) as Topic[]
    },
  })
  const contests = useQuery({ queryKey: ['contests'], queryFn: listContests, enabled: !!user, staleTime: 60_000 })
  const open = (contests.data ?? []).map((c) => ({ ...c, phase: contestPhase(c) })).filter((c) => c.phase === 'open')
  const firstName = (profile?.display_name || '').split(' ')[0]

  return (
    <div className="space-y-10">
      {/* Welcome: one slim row for everyone, so visitors see the conversations straight away. */}
      <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">
            {!user
              ? 'Welcome to AbiaConnect'
              : firstDay
                ? `Welcome, ${firstName || 'friend'} 👋🏾`
                : firstName
                  ? `Welcome back, ${firstName}`
                  : 'Welcome back'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
            <span>
              {user && firstDay && !journey.data?.bonus_claimed ? 'Glad you’re here. Your first steps are just below.' : 'Here’s what the community is talking about.'}
            </span>
            <OnlineMembersPill />
          </div>
        </div>
        {user ? (
          <Button asChild size="lg" className="h-11 rounded-full px-6">
            <Link to="/create-thread">
              <PenSquare className="size-4" /> Start a discussion
            </Link>
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button asChild size="lg" className="h-11 rounded-full px-6">
              <Link to="/register">
                Join free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        )}
      </section>
      {user ? <StarterSteps /> : null}
      {user ? <BirthdayGreeting /> : null}
      {user ? <AddBirthdayPrompt /> : null}

      {/* Announcements and advertisements (managed by admins) */}
      <HeroSlider />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {/* Discussions come first: real conversations are what make people stay. */}
          <section aria-labelledby="discussions-heading">
            <h2 id="discussions-heading" className="mb-4 text-2xl font-semibold">
              Discussions
            </h2>
            {user ? (
              <Link to="/create-thread" className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40">
                <UserAvatar avatarUrl={profile?.avatar_url} displayName={profile?.display_name ?? 'You'} size="md" />
                <span className="min-w-0 flex-1 truncate rounded-full border border-border bg-muted/40 px-4 py-2.5 text-muted-foreground">
                  What’s on your mind{firstName ? `, ${firstName}` : ''}?
                </span>
              </Link>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-border">
              <CommunityFeed />
            </div>
          </section>

          {/* Topic index: a short list with the rest one tap away. */}
          <section aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="mb-4 text-2xl font-semibold">
              Browse by topic
            </h2>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
              {(allTopics ? topics.data ?? [] : (topics.data ?? []).slice(0, TOPICS_SHOWN)).map((c) => {
                const count = shownCount(c.thread_count)
                return (
                  <Link
                    key={c.id}
                    to={c.slug === 'relationship' ? '/relationship' : `/category/${c.id}`}
                    className="flex gap-4 bg-card p-5 transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: `${c.color ?? '#1B3D1B'}1F` }}
                      aria-hidden
                    >
                      {c.icon ?? '💬'}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{c.name}</span>
                      {c.description ? <span className="mt-0.5 block line-clamp-2 text-sm text-muted-foreground">{c.description}</span> : null}
                      {count ? (
                        <span className="mt-1.5 block text-xs font-medium text-muted-foreground">{count.toLocaleString()} discussions</span>
                      ) : null}
                    </span>
                  </Link>
                )
              })}
              {topics.isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-card" />) : null}
            </div>
            {(topics.data?.length ?? 0) > TOPICS_SHOWN ? (
              <Button variant="outline" className="mt-4 w-full rounded-full" onClick={() => setAllTopics((v) => !v)}>
                {allTopics ? 'Show fewer topics' : `Show all ${topics.data?.length} topics`}
              </Button>
            ) : null}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {user ? <JoinInTodayCard /> : null}
          {user ? <WaitingForReplyCard /> : null}
          <QuestionOfTheDayCard />
          {user ? <DailyRewardCard /> : null}
          {user ? <QuickPollCard /> : null}
          <LgaOfTheMonthCard />
          {user ? <OpportunitiesCard /> : null}
          {user ? <InviteCard /> : null}

          {open.length ? (
            <SideCard title="Vote now" icon={Vote} action={{ to: '/contests', label: 'All contests' }}>
              <ul className="space-y-2">
                {open.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link to={`/contests/${c.id}`} className="block rounded-lg px-2 py-1.5 font-medium hover:bg-muted/60">
                      {c.title}
                      <span className="block text-xs font-normal text-muted-foreground">
                        Closes {formatDistanceToNow(new Date(c.ends_at), { addSuffix: true })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SideCard>
          ) : null}

          {user ? (
            <SideCard title="Community leaderboard" icon={Trophy} action={{ to: '/leaderboard', label: 'See all' }}>
              <p className="text-sm text-muted-foreground">Earn points for taking part and climb the weekly board.</p>
              <Link to="/rewards" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">
                My rewards →
              </Link>
            </SideCard>
          ) : null}

          <SideCard title="Get started" icon={BookOpen}>
            <ul className="space-y-1.5 text-sm">
              {[
                { to: '/forum-guidelines', label: 'Forum guidelines' },
                { to: '/subgroups', label: 'Find a group' },
                { to: '/events', label: 'Upcoming events' },
                { to: '/help', label: 'Help centre' },
              ].map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/60">
                    {l.label} <ArrowRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </SideCard>

          {!user ? (
            <SideCard title="Events" icon={CalendarDays} action={{ to: '/events', label: 'View' }}>
              <p className="text-sm text-muted-foreground">Community gatherings, festivals and meetups across Abia and the diaspora.</p>
            </SideCard>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function SideCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: typeof Vote
  action?: { to: string; label: string }
  children: React.ReactNode
}) {
  return (
    <CollapsibleCard
      name={title}
      className="p-5"
      title={
        <>
          <Icon className="size-4 text-primary" /> {title}
        </>
      }
      action={
        action ? (
          <Link to={action.to} className="shrink-0 text-sm font-medium text-primary hover:underline">
            {action.label}
          </Link>
        ) : null
      }
    >
      {children}
    </CollapsibleCard>
  )
}

export default WebHome
