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
import { NewDiscussionsBanner, OnlineMembersPill } from '@/components/engagement/LiveCommunity'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { useCommunityStats } from '@/hooks/useCommunityStats'
import { supabase } from '@/lib/supabase'
import { contestPhase, listContests } from '@/lib/engagement'
import { cn } from '@/lib/utils'

type FeedTab = 'latest' | 'popular' | 'unanswered'

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

async function loadFeed(tab: FeedTab): Promise<FeedRow[]> {
  let query = supabase
    .from('threads')
    .select('id, title, created_at, is_pinned, is_anonymous, view_count, author_id, replies(count), categories(id, name, icon)')
    .eq('is_deleted', false)
    .is('subgroup_id', null)
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
  }
  let rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    reply_count: r.replies?.[0]?.count ?? 0,
    category: (Array.isArray(r.categories) ? r.categories[0] : r.categories) ?? null,
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
  const stats = useCommunityStats()
  const [tab, setTab] = useState<FeedTab>('latest')
  const feed = useQuery({ queryKey: ['web-home-feed', tab], queryFn: () => loadFeed(tab), staleTime: 30_000 })
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
      {/* Welcome */}
      {user ? (
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
              <span>Here’s what the community is talking about.</span>
              <OnlineMembersPill />
            </div>
          </div>
          <Button asChild size="lg" className="h-11 rounded-full px-6">
            <Link to="/create-thread">
              <PenSquare className="size-4" /> Start a discussion
            </Link>
          </Button>
        </section>
      ) : null}
      {user ? <BirthdayGreeting /> : null}
      {user ? null : (
        <section className="grid items-center gap-8 rounded-3xl border border-border bg-gradient-to-br from-primary/[0.06] via-background to-secondary/[0.08] p-8 md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">The Abia community online</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">The trusted digital home for Abians worldwide</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Join thoughtful discussions, connect with professionals and friends, and take part in community decisions,
              at home and across the diaspora.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                <Link to="/register">
                  Join free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-7 text-base">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 md:grid-cols-1">
            {[
              { label: 'Discussions', value: stats.data?.discussions },
              { label: 'Community groups', value: stats.data?.groups },
              { label: 'Forum topics', value: stats.data?.topics },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card/80 px-5 py-4">
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="mt-0.5 text-2xl font-semibold text-foreground md:text-3xl">{s.value == null ? '—' : s.value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {/* Discussions */}
          <section aria-labelledby="discussions-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 id="discussions-heading" className="text-2xl font-semibold">
                Discussions
              </h2>
              <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Sort discussions">
                {(['latest', 'popular', 'unanswered'] as FeedTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn(
                      '-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
                      tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <NewDiscussionsBanner queryKeys={[['web-home-feed']]} />
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_88px_88px_120px] gap-4 border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>Topic</span>
                <span className="text-center">Replies</span>
                <span className="text-center">Views</span>
                <span className="text-right">Activity</span>
              </div>
              {feed.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="m-4 h-12 animate-pulse rounded-lg bg-muted" />)
              ) : feed.isError ? (
                <p className="p-6 text-center text-muted-foreground">Couldn’t load discussions. Please refresh.</p>
              ) : !feed.data?.length ? (
                <p className="p-8 text-center text-muted-foreground">
                  {tab === 'unanswered' ? 'Every recent discussion has a reply. 🎉' : 'No discussions yet.'}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {feed.data.map((t) => {
                    const name = t.is_anonymous ? 'Anonymous member' : t.author?.display_name || 'Member'
                    return (
                      <li key={t.id}>
                        <Link
                          to={`/thread/${t.id}`}
                          className="grid gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_88px_88px_120px] md:items-center"
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
                                {t.category ? (
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
                          <span className="flex items-center gap-1 text-sm text-muted-foreground md:justify-center">
                            <MessageCircle className="size-3.5 md:hidden" /> {t.reply_count}
                            <span className="md:hidden">replies</span>
                          </span>
                          <span className="hidden text-center text-sm text-muted-foreground md:block">
                            {t.view_count.toLocaleString()}
                          </span>
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

          {/* Topic index */}
          <section aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="mb-4 text-2xl font-semibold">
              Browse by topic
            </h2>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
              {(topics.data ?? []).map((c) => (
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
                    <span className="mt-1.5 block text-xs font-medium text-muted-foreground">
                      {(c.thread_count ?? 0).toLocaleString()} {c.thread_count === 1 ? 'discussion' : 'discussions'}
                    </span>
                  </span>
                </Link>
              ))}
              {topics.isLoading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse bg-card" />) : null}
            </div>
          </section>

          {/* Admin banners */}
          <HeroSlider />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {user ? <DailyRewardCard /> : null}

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
