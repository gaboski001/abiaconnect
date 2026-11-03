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
import { NewDiscussionsBanner, OnlineMembersPill } from '@/components/engagement/LiveCommunity'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { contestPhase, listContests } from '@/lib/engagement'
import { daysSince, useJourney } from '@/lib/journey'
import { cn } from '@/lib/utils'
import { QuickPollCard } from '@/components/engagement/QuickPollCard'
import { QuestionOfTheDayCard } from '@/components/engagement/QuestionOfTheDayCard'
import { WaitingForReplyCard } from '@/components/engagement/WaitingForReplyCard'
import { feedFilter, useNewsdeskAuthor } from '@/lib/feed'
import { shownCount } from '@/lib/quietNumbers'

type FeedTab = 'community' | 'my-lga' | 'news' | 'popular' | 'unanswered'

/** Topics shown before "Show all topics". */
const TOPICS_SHOWN = 6

const TAB_LABELS: Record<FeedTab, string> = {
  community: 'From members',
  'my-lga': 'From your LGA',
  news: 'News',
  popular: 'Popular',
  unanswered: 'Needs a reply',
}

interface FeedRow {
  id: string
  title: string
  created_at: string
  is_pinned: boolean
  is_anonymous: boolean
  view_count: number
  author_id: string | null
  reply_count: number
  category: { id: string; name: string; icon: string | null } | null
  group: { name: string } | null
  author: { display_name: string | null; avatar_url: string | null } | null
}

interface Topic {
  id: string
  name: string
  slug: string | null
  description: string | null
  icon: string | null
  color: string | null
  thread_count: number
}

async function loadFeed(tab: FeedTab, lgaGroup: string | null, newsdesk: string | null): Promise<FeedRow[]> {
  let query = supabase
    .from('threads')
    .select('id, title, created_at, is_pinned, is_anonymous, view_count, author_id, replies(count), categories(id, name, icon), subgroups(name)')
    .eq('is_deleted', false)
  // Members' posts (forum and groups) come first; the Newsdesk's news has its own tab.
  if (tab === 'my-lga' && lgaGroup) query = query.eq('subgroup_id', lgaGroup)
  else if (tab === 'community' || tab === 'unanswered') query = feedFilter(query, 'community', newsdesk)
  else if (tab === 'news') query = feedFilter(query, 'news', newsdesk)
  else query = query.is('subgroup_id', null)
  if (tab === 'popular') {
    query = query.gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()).order('view_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }
  const { data, error } = await query.limit(tab === 'unanswered' ? 60 : 15)
  if (error) throw error
  type Raw = Omit<FeedRow, 'reply_count' | 'category' | 'author'> & {
    replies?: { count: number }[]
    categories?: FeedRow['category'] | FeedRow['category'][]
    subgroups?: FeedRow['group'] | FeedRow['group'][]
  }
  let rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    reply_count: r.replies?.[0]?.count ?? 0,
    category: (Array.isArray(r.categories) ? r.categories[0] : r.categories) ?? null,
    group: (Array.isArray(r.subgroups) ? r.subgroups[0] : r.subgroups) ?? null,
    author: null as FeedRow['author'],
  }))
  if (tab === 'unanswered') rows = rows.filter((r) => r.reply_count === 0).slice(0, 15)
  const ids = Array.from(new Set(rows.filter((r) => !r.is_anonymous && r.author_id).map((r) => r.author_id as string)))
  if (ids.length) {
    const { data: profs } = await supabase.rpc('get_public_profiles', { _ids: ids })
    const map = new Map(
      ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>).map((p) => [p.id, p]),
    )
    rows = rows.map((r) => ({ ...r, author: !r.is_anonymous && r.author_id ? map.get(r.author_id) ?? null : null }))
  }
  return rows
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
  const lgaGroup = journey.data?.lga_group ?? null
  const [tab, setTab] = useState<FeedTab>('community')
  const [allTopics, setAllTopics] = useState(false)
  const tabs: FeedTab[] = lgaGroup ? ['community', 'my-lga', 'news', 'popular', 'unanswered'] : ['community', 'news', 'popular', 'unanswered']
  const newsdesk = useNewsdeskAuthor()
  const feed = useQuery({
    queryKey: ['web-home-feed', tab, lgaGroup, newsdesk.data ?? null],
    enabled: newsdesk.isFetched,
    queryFn: () => loadFeed(tab, lgaGroup, newsdesk.data ?? null),
    staleTime: 30_000,
  })
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
              {user && firstDay ? 'Glad you’re here. Your first steps are just below.' : 'Here’s what the community is talking about.'}
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
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 id="discussions-heading" className="text-2xl font-semibold">
                Discussions
              </h2>
              <div
                className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none]"
                role="tablist"
                aria-label="Sort discussions"
              >
                {tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn(
                      // The four tabs are wider than a small phone: they scroll instead of
                      // widening the page.
                      'shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
                      tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <NewDiscussionsBanner queryKeys={[['web-home-feed']]} />
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {/* No views column: low view counts make a young forum look empty. */}
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px] gap-4 border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>Topic</span>
                <span className="text-center">Replies</span>
                <span className="text-right">Activity</span>
              </div>
              {feed.isPending ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="m-4 h-12 animate-pulse rounded-lg bg-muted" />)
              ) : feed.isError ? (
                <p className="p-6 text-center text-muted-foreground">Couldn’t load discussions. Please refresh.</p>
              ) : !feed.data?.length ? (
                <p className="p-8 text-center text-muted-foreground">
                  {tab === 'unanswered' ? (
                    'Every recent discussion has a reply. 🎉'
                  ) : tab === 'my-lga' ? (
                    <>
                      Your LGA group is quiet so far.{' '}
                      <Link to={`/subgroups/${lgaGroup}`} className="font-semibold text-primary hover:underline">
                        Be the first to start a conversation
                      </Link>
                    </>
                  ) : (
                    tab === 'community' ? 'No posts from members yet. Start the first conversation!' : 'No discussions yet.'
                  )}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {feed.data.map((t) => {
                    const name = t.is_anonymous ? 'Anonymous member' : t.author?.display_name || 'Member'
                    return (
                      <li key={t.id}>
                        <Link
                          to={`/thread/${t.id}`}
                          className="grid gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_120px_120px] md:items-center"
                        >
                          <div className="flex min-w-0 gap-3">
                            <UserAvatar avatarUrl={t.author?.avatar_url} displayName={name} size="sm" className="mt-0.5 hidden h-9 w-9 border-0 sm:block" />
                            <div className="min-w-0">
                              <p className="flex items-start gap-1.5 font-semibold leading-snug text-foreground">
                                {t.is_pinned ? <Pin className="mt-1 size-3.5 shrink-0 text-amber-500" aria-label="Pinned" /> : null}
                                <span className="line-clamp-2">{t.title}</span>
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                                <span>{name}</span>
                                {t.group ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>👥 {t.group.name}</span>
                                  </>
                                ) : t.category ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>
                                      {t.category.icon ?? '💬'} {t.category.name}
                                    </span>
                                  </>
                                ) : null}
                              </p>
                            </div>
                          </div>
                          {t.reply_count ? (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground md:justify-center">
                              <MessageCircle className="size-3.5 md:hidden" /> {t.reply_count}
                              <span className="md:hidden">{t.reply_count === 1 ? 'reply' : 'replies'}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-sm font-semibold text-primary md:justify-center">
                              <MessageCircle className="size-3.5" /> Reply first
                            </span>
                          )}
                          <span className="text-sm text-muted-foreground md:text-right">
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
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
          {user ? <WaitingForReplyCard /> : null}
          <QuestionOfTheDayCard />
          {user ? <DailyRewardCard /> : null}
          {user ? <QuickPollCard /> : null}

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
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 text-primary" /> {title}
        </h3>
        {action ? (
          <Link to={action.to} className="text-sm font-medium text-primary hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export default WebHome
