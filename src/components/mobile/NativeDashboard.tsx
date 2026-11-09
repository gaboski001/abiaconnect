import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Bookmark, Briefcase, CalendarDays, ChevronRight, Eye, FileText, Gift, MapPin, Pencil, PenSquare, Phone, Settings, Trophy, Users, Vote } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { getConnectSummary } from '@/lib/connect'
import { useJourney } from '@/lib/journey'
import { APP_HEADER_GRADIENT } from '@/lib/mobileBrand'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { BirthdayGreeting } from '@/components/engagement/BirthdayGreeting'
import { BirthdaysTodayCard } from '@/components/engagement/BirthdaysTodayCard'
import { AddBirthdayPrompt } from '@/components/engagement/AddBirthdayPrompt'
import { DailyRewardCard } from '@/components/engagement/DailyRewardCard'
import { WaitingForReplyCard } from '@/components/engagement/WaitingForReplyCard'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { CommunityFeed } from '@/components/community/CommunityFeed'
import { InviteCard, JoinInTodayCard, LgaOfTheMonthCard, PageProgressBar } from '@/components/community/CommunityCards'

const ActivityChart = lazy(() => import('@/components/dashboard/ActivityChart'))

interface NativeDashboardProps {
  profile: {
    id?: string
    display_name?: string | null
    username?: string | null
    avatar_url?: string | null
    lga?: string | null
    reputation?: number | null
  }
  stats: {
    posts: number
    replies: number
    bookmarks: number
    reputation: number
  }
  chartData: Array<{ label: string; posts: number }>
  recentThreads: Array<{ id: string; title: string; created_at: string }>
}

/** The app's dashboard: your page and tools first, then the community, like a social profile. */
export function NativeDashboard({ profile, stats, chartData, recentThreads }: NativeDashboardProps) {
  const { user } = useAuth()
  const journey = useJourney()
  const displayName = profile.display_name || 'User'
  const lgaGroup = journey.data?.lga_group ?? null
  const summaryQ = useQuery({
    queryKey: ['member-summary', user?.id],
    enabled: !!user,
    queryFn: () => getConnectSummary(user!.id).catch(() => null),
  })

  const tiles = [
    { to: '/dashboard?tab=posts', label: 'My posts', icon: FileText },
    { to: '/dashboard?tab=saved', label: 'Saved', icon: Bookmark },
    { to: '/relationship/people', label: 'People', icon: Users },
    { to: '/rewards', label: 'Rewards', icon: Gift },
    { to: lgaGroup ? `/subgroups/${lgaGroup}` : '/subgroups', label: lgaGroup ? 'My LGA' : 'Groups', icon: MapPin },
    { to: '/contests', label: 'Vote', icon: Vote },
    { to: '/events', label: 'Events', icon: CalendarDays },
    { to: '/leaderboard', label: 'Top members', icon: Trophy },
    { to: '/opportunities', label: 'Jobs', icon: Briefcase },
    { to: '/dashboard?tab=calls', label: 'Calls', icon: Phone },
    { to: '/create-thread', label: 'New post', icon: PenSquare },
    { to: '/dashboard?tab=settings', label: 'Settings', icon: Settings },
  ]
  const numbers = [
    { label: 'Posts', value: stats.posts },
    { label: 'Replies', value: stats.replies },
    { label: 'Reputation', value: stats.reputation },
    { label: 'Followers', value: summaryQ.data?.followers ?? 0 },
  ]

  return (
    <div className="-mx-3 -mt-6 flex flex-col gap-2 pb-28">
      {/* My page */}
      <section className="bg-card">
        <div className="h-24" style={{ backgroundImage: APP_HEADER_GRADIENT }} />
        <div className="px-4 pb-4">
          <div className="-mt-11 flex items-end gap-3">
            <UserAvatar avatarUrl={profile.avatar_url} displayName={displayName} size="xl" className="size-[88px] border-4 border-card" />
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-xl font-extrabold leading-tight">{displayName}</h1>
              <p className="truncate text-[13px] text-muted-foreground">{[profile.username ? `@${profile.username}` : null, profile.lga].filter(Boolean).join(' · ')}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 divide-x divide-border rounded-xl border border-border py-2.5 text-center">
            {numbers.map((n) => (
              <div key={n.label}>
                <span className="block text-lg font-extrabold leading-tight">{n.value}</span>
                <span className="block text-[11px] text-muted-foreground">{n.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to={`/member/${user?.id ?? ''}`}>
                <Eye className="size-4" /> My page
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/profile">
                <Pencil className="size-4" /> Edit page
              </Link>
            </Button>
          </div>
          <PageProgressBar profile={profile} className="mt-3" />
        </div>
      </section>

      <div className="space-y-2 px-3 empty:hidden">
        <BirthdayGreeting />
        <BirthdaysTodayCard />
        <AddBirthdayPrompt />
      </div>

      {/* Announcements and promotions (managed by admins) */}
      <section className="px-3">
        <HeroSlider compact />
      </section>

      <section className="grid grid-cols-4 gap-2 px-3" aria-label="My tools">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="flex flex-col items-center gap-1.5 rounded-2xl bg-card py-3 text-center text-[12px] font-semibold shadow-sm">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <t.icon className="size-5" />
            </span>
            {t.label}
          </Link>
        ))}
      </section>

      <section className="space-y-2 px-3">
        <DailyRewardCard />
        <JoinInTodayCard />
        <WaitingForReplyCard compact />
      </section>

      {/* The main forum, without leaving the dashboard */}
      <CommunityFeed pageSize={5} moreLink={{ to: '/', label: 'Open the full forum' }} />

      <section className="space-y-2 px-3">
        <LgaOfTheMonthCard />
        <InviteCard />

        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-[15px] font-bold">Posts I made this week</h2>
          <div className="h-44 w-full">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-muted" />}>
              <ActivityChart data={chartData} />
            </Suspense>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">My recent threads</h2>
            <Link to="/dashboard?tab=posts" className="text-[13px] font-bold text-primary">
              See all
            </Link>
          </div>
          {!recentThreads.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No threads yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentThreads.map((thread) => (
                <li key={thread.id}>
                  <Link to={`/thread/${thread.id}`} className="flex items-center gap-2 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{thread.title}</span>
                      <span className="block text-xs text-muted-foreground">{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
