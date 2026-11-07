import { Fragment, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { BarChart3, Briefcase, CalendarDays, ChevronRight, Gift, Heart, PenSquare, Sparkles, Trophy, Vote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { shownCount } from '@/lib/quietNumbers'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { APP_HEADER_GRADIENT, GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'
import { DailyRewardCard } from '@/components/engagement/DailyRewardCard'
import { BirthdayGreeting } from '@/components/engagement/BirthdayGreeting'
import { AddBirthdayPrompt } from '@/components/engagement/AddBirthdayPrompt'
import { StarterSteps, useWelcomeRedirect } from '@/components/engagement/StarterSteps'
import { daysSince, useJourney } from '@/lib/journey'
import { CommunityFeed } from '@/components/community/CommunityFeed'
import { InviteCard, JoinInTodayCard, LgaOfTheMonthCard } from '@/components/community/CommunityCards'
import { OnlineMembersPill } from '@/components/engagement/LiveCommunity'
import { ContestCard } from '@/pages/Contests'
import { contestPhase, listContests } from '@/lib/engagement'
import { QuickPollCard } from '@/components/engagement/QuickPollCard'
import { QuestionOfTheDayCard } from '@/components/engagement/QuestionOfTheDayCard'
import { WaitingForReplyCard } from '@/components/engagement/WaitingForReplyCard'
import { feedFilter, useNewsdeskAuthor } from '@/lib/feed'

interface Category {
  id: string
  name: string
  slug: string | null
  icon: string | null
  color: string | null
  thread_count: number
  is_popular: boolean
}

const QUICK_ACTIONS = [
  { to: '/relationship', label: 'Connect', icon: Heart, tone: 'bg-pink-500/15 text-pink-600 dark:text-pink-300' },
  { to: '/opportunities', label: 'Jobs', icon: Briefcase, tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { to: '/polls', label: 'Polls', icon: BarChart3, tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-300' },
  { to: '/contests', label: 'Contests', icon: Vote, tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
  { to: '/rewards', label: 'Rewards', icon: Gift, tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  { to: '/events', label: 'Events', icon: CalendarDays, tone: 'bg-teal-500/15 text-teal-700 dark:text-teal-300' },
  { to: '/leaderboard', label: 'Top members', icon: Trophy, tone: 'bg-orange-500/15 text-orange-600 dark:text-orange-300' },
]

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The app's home screen: a personal welcome, admin announcements, the latest
 * discussions and the forum topics — laid out for a phone, with one obvious
 * next step ("Start a discussion" for members, "Join" for visitors).
 */
export function NativeHome() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const firstName = (profile?.display_name || profile?.username || '').split(' ')[0]
  const journey = useJourney()
  useWelcomeRedirect()
  const firstDay = daysSince(journey.data?.created_at) < 1

  const contestsQ = useQuery({ queryKey: ['contests'], queryFn: listContests, enabled: !!user, staleTime: 60_000 })
  const openContests = (contestsQ.data ?? [])
    .map((c) => ({ ...c, phase: contestPhase(c) }))
    .filter((c) => c.phase === 'open')

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })

  // Members' posts first; the Newsdesk's news in a short list of its own.
  const newsdesk = useNewsdeskAuthor()
  const newsQ = useQuery({
    queryKey: ['native-home-news', newsdesk.data ?? null],
    enabled: newsdesk.isFetched && !!newsdesk.data,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await feedFilter(
        supabase.from('threads').select('id, title, created_at').eq('is_deleted', false),
        'news',
        newsdesk.data ?? null,
      )
        .order('created_at', { ascending: false })
        .limit(4)
      if (error) throw error
      return (data ?? []) as { id: string; title: string; created_at: string }[]
    },
  })
  /**
   * Other cards sit between the posts, as on a social feed. Whatever the feed is
   * too short to reach still shows after its last post, so nothing is lost.
   */
  const slots: Array<ReactNode> = [
    <section key="question" className="space-y-2 bg-transparent empty:hidden">
      <QuestionOfTheDayCard compact />
    </section>,
    null,
    <Fragment key="connect">
      <section className="px-4">
        <Link
          to={user ? '/relationship' : '/register'}
          className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-pink-600 to-rose-500 p-4 text-white shadow-lg transition-transform active:scale-[0.98]"
        >
          <span className="flex size-14 shrink-0 rotate-[-6deg] items-center justify-center rounded-2xl bg-white/20">
            <Heart className="size-7" fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-extrabold leading-tight">Meet people from home</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/90">
              Abians looking for work, business partners, friends and more.
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0" />
        </Link>
      </section>

      {user ? (
        <section className="px-4 empty:hidden">
          <QuickPollCard compact />
        </section>
      ) : null}
    </Fragment>,
    null,
    <Fragment key="vote">
      {openContests.length ? (
        <section className="px-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[18px] font-bold tracking-tight text-foreground">Vote now</h2>
            <Link to="/contests" className="text-[14px] font-semibold text-amber-600 dark:text-amber-300">
              See all
            </Link>
          </div>
          <ul className="space-y-2.5">
            {openContests.slice(0, 3).map((c) => (
              <li key={c.id}>
                <ContestCard c={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="px-4 empty:hidden">
        <LgaOfTheMonthCard />
      </section>
    </Fragment>,
    null,
    <Fragment key="topics">
      {/* Topics */}
      <section className="px-4">
        <SectionHeader title="Browse topics" />
        {categoriesQ.isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : categoriesQ.isError ? (
          <ErrorCard onRetry={() => categoriesQ.refetch()} />
        ) : !categoriesQ.data?.length ? (
          <EmptyCard text="Topics will appear here soon." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {categoriesQ.data.map((c) => {
              const color = c.color ?? '#1B3D1B'
              const href = c.slug === 'relationship' ? '/relationship' : `/category/${c.id}`
              return (
                <Link
                  key={c.id}
                  to={href}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm transition-transform active:scale-[0.98]"
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${color}26` }}
                    aria-hidden
                  >
                    {c.icon ?? '💬'}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[14px] font-semibold leading-tight text-foreground">{c.name}</span>
                    {shownCount(c.thread_count) ? (
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">{c.thread_count} threads</span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Latest discussions */}
      {newsQ.data?.length ? (
        <section className="px-4">
          <SectionHeader title="📰 Today's news" />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {newsQ.data.map((n) => (
              <li key={n.id}>
                <Link to={`/thread/${n.id}`} className="block px-4 py-3 transition-colors active:bg-muted">
                  <span className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground">{n.title}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {user ? (
        <section className="px-4 empty:hidden">
          <InviteCard />
        </section>
      ) : null}
    </Fragment>,
  ]
  const between = (i: number, total: number) => {
    const shown = i === total - 1 ? slots.slice(Math.max(i, 0)) : [slots[i]]
    return shown.some(Boolean) ? <div className="space-y-4 py-2">{shown}</div> : null
  }

  return (
    <div className="-mx-4 -mt-4 space-y-2">
      {/* Welcome */}
      <section
        className="dark relative overflow-hidden px-4 pb-14 pt-3 text-white"
        style={{ backgroundImage: APP_HEADER_GRADIENT }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(248,195,1,0.28) 0%, rgba(248,195,1,0) 70%)' }}
          aria-hidden
        />
        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-[20px] font-extrabold leading-tight tracking-tight text-white">
              {firstDay ? `Welcome, ${firstName || 'friend'} 👋🏾` : `${greeting()}${firstName ? `, ${firstName}` : ''}`}
            </h1>
            <OnlineMembersPill />
          </div>
        ) : (
          <>
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-300">
              <Sparkles className="size-4" /> Welcome to AbiaConnect
            </p>
            <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-white">
              The trusted digital home for Abians worldwide
            </h1>
            <p className="mt-1.5 text-[15px] leading-6 text-white/80">
              Join conversations, meet professionals and stay informed.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Link
                to="/register"
                className="flex h-12 items-center justify-center rounded-xl text-[15px] font-bold text-[#0B1F0B]"
                style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              >
                Join free
              </Link>
              <Link
                to="/login"
                className="flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-[15px] font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
          </>
        )}
      </section>

      {user ? (
        <section className="relative z-10 -mt-12 px-4">
          <div className="rounded-2xl bg-card p-3 shadow-md">
            <Link to="/create-thread" className="flex items-center gap-3">
              <UserAvatar avatarUrl={profile?.avatar_url} displayName={profile?.display_name ?? 'You'} size="md" className="size-11" />
              <span className="min-w-0 flex-1 truncate rounded-full border border-border bg-muted/50 px-4 py-2.5 text-[14px] text-muted-foreground">
                What’s on your mind{firstName ? `, ${firstName}` : ''}?
              </span>
            </Link>
            <Link
              to="/create-thread"
              className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-[#1E1800]"
              style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
            >
              <PenSquare className="size-[18px]" />
              Start a discussion
            </Link>
          </div>
        </section>
      ) : null}

      {/* Announcements and promotions (managed by admins) */}
      <section className="px-4">
        <HeroSlider compact />
      </section>

      {user ? (
        <section className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Quick links">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-card py-3 text-center text-[12px] font-semibold text-foreground shadow-sm"
            >
              <span className={`flex size-11 items-center justify-center rounded-2xl ${a.tone}`}>
                <a.icon className="size-[22px]" />
              </span>
              {a.label}
            </Link>
          ))}
        </section>
      ) : null}

      {user ? (
        <section className="space-y-2 px-4 empty:hidden">
          <BirthdayGreeting />
          <AddBirthdayPrompt />
          <StarterSteps compact />
          <WaitingForReplyCard compact />
          <DailyRewardCard />
          <JoinInTodayCard />
        </section>
      ) : null}

      <CommunityFeed between={between} />
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[18px] font-bold tracking-tight text-foreground">{title}</h2>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-[14px] text-muted-foreground">
      {text}
    </div>
  )
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <p className="text-[14px] text-muted-foreground">Couldn’t load this right now.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-amber-600 dark:text-amber-300"
      >
        Try again <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export default NativeHome
