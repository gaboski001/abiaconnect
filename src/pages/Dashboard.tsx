import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
const CallHistory = lazy(() => import('@/components/dashboard/CallHistory'))
import { toWebP } from '@/lib/image'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, startOfDay, subDays, format } from 'date-fns'

const ActivityChart = lazy(() => import('@/components/dashboard/ActivityChart'))
import {
  Bell,
  Bookmark,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  PhoneOff,
  Settings as SettingsIcon,
  Trash2,
  BarChart3,
  Briefcase,
  CalendarDays,
  Eye,
  Gift,
  MapPin,
  MessageCircle,
  Pencil,
  PenSquare,
  Trophy,
  Users,
  Vote,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { areCallsEnabled, hydrateCallsEnabledFromProfile, setCallsEnabled, subscribeCallsEnabled } from '@/lib/callPreferences'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'
import { saveProfile } from '@/lib/profileUpdate'
import { BioField } from '@/components/profile/BioField'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { NotificationSoundToggle } from '@/components/notifications/NotificationSoundToggle'

import { NativeAppDownload } from '@/components/pwa/NativeAppDownload'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { NativeDashboard } from '@/components/mobile/NativeDashboard'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { CommunityFeed } from '@/components/community/CommunityFeed'
import { InviteCard, JoinInTodayCard, LgaOfTheMonthCard, OpportunitiesCard, PageProgressBar } from '@/components/community/CommunityCards'
import { DailyRewardCard } from '@/components/engagement/DailyRewardCard'
import { QuestionOfTheDayCard } from '@/components/engagement/QuestionOfTheDayCard'
import { CollapsibleCard } from '@/components/community/CollapsibleCard'
import { WaitingForReplyCard } from '@/components/engagement/WaitingForReplyCard'
import { useUnreadMessagesCount } from '@/components/messages/MessagesBell'
import { getConnectSummary } from '@/lib/connect'
import { contestPhase, listContests } from '@/lib/engagement'
import { useJourney } from '@/lib/journey'
import { APP_HEADER_GRADIENT } from '@/lib/mobileBrand'
import { BirthdayGreeting } from '@/components/engagement/BirthdayGreeting'
import { BirthdaysTodayCard } from '@/components/engagement/BirthdaysTodayCard'
import { AddBirthdayPrompt } from '@/components/engagement/AddBirthdayPrompt'
import { deleteAttachmentPaths, extractAttachmentPaths } from '@/lib/threadAttachments'

type Tab = 'overview' | 'posts' | 'saved' | 'messages' | 'calls' | 'notifications' | 'settings'

type NavItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  tab?: Tab
  to?: string
  badge?: number
}

interface Profile {
  id?: string
  display_name?: string | null
  username?: string | null
  bio?: string | null
  lga?: string | null
  avatar_url?: string | null
  reputation?: number | null
}

export default function Dashboard() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'overview'
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next })
  const journey = useJourney()
  const unreadMessages = useUnreadMessagesCount()
  const summaryQ = useQuery({
    queryKey: ['member-summary', user?.id],
    enabled: !!user,
    queryFn: () => getConnectSummary(user!.id).catch(() => null),
  })

  const profileQ = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return (row ?? {}) as Profile
    },
  })

  const statsQ = useQuery({
    queryKey: ['dash-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id
      const [posts, replies, bookmarks, profile] = await Promise.all([
        supabase.from('threads').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('replies').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('profiles').select('reputation').eq('id', uid).maybeSingle(),
      ])
      return {
        posts: posts.count ?? 0,
        replies: replies.count ?? 0,
        bookmarks: bookmarks.count ?? 0,
        reputation: (profile.data as { reputation?: number } | null)?.reputation ?? 0,
      }
    },
  })

  const activityQ = useQuery({
    queryKey: ['dash-activity', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = startOfDay(subDays(new Date(), 6)).toISOString()
      const { data, error } = await supabase
        .from('threads')
        .select('created_at')
        .eq('user_id', user!.id)
        .gte('created_at', since)
      if (error) throw error
      return (data ?? []) as Array<{ created_at: string }>
    },
  })

  const recentQ = useQuery({
    queryKey: ['my-recent-threads', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('id, title, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; title: string; created_at: string }>
    },
  })

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)))
    const counts = new Map(days.map((d) => [format(d, 'yyyy-MM-dd'), 0]))
    for (const row of activityQ.data ?? []) {
      const key = format(startOfDay(new Date(row.created_at)), 'yyyy-MM-dd')
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return days.map((d) => ({
      label: format(d, 'EEE'),
      posts: counts.get(format(d, 'yyyy-MM-dd')) ?? 0,
    }))
  }, [activityQ.data])

  const profile = profileQ.data ?? {}
  const displayName = profile.display_name || user?.email?.split('@')[0] || 'You'

  if (isNativeApp()) {
    return (
      <div className="-mt-6 -mx-3 px-3 py-6 min-h-screen bg-muted/50">
        <SEO title="Dashboard" description="Your AbiaConnect Dashboard" path="/dashboard" />
        {tab === 'overview' ? (
          <NativeDashboard
            profile={profile}
            stats={statsQ.data ?? { posts: 0, replies: 0, bookmarks: 0, reputation: 0 }}
            chartData={chartData}
            recentThreads={recentQ.data ?? []}
          />
        ) : (
          <div className="pb-28">
            <TabPanel tab={tab} profile={profile} onSaved={() => profileQ.refetch()} onDeleted={() => qc.invalidateQueries({ queryKey: ['my-threads'] })} />
          </div>
        )}
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const lgaGroup = journey.data?.lga_group ?? null
  const groups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'My page',
      items: [
        { label: 'Overview', icon: LayoutDashboard, tab: 'overview' },
        { label: 'My public page', icon: Eye, to: `/member/${user?.id ?? ''}` },
        { label: 'My posts', icon: FileText, tab: 'posts' },
        { label: 'Saved posts', icon: Bookmark, tab: 'saved' },
        { label: 'Followers & likes', icon: Users, to: '/relationship/people' },
        { label: 'Rewards', icon: Gift, to: '/rewards' },
      ],
    },
    {
      title: 'Community',
      items: [
        { label: 'Forum', icon: MessageCircle, to: '/' },
        { label: lgaGroup ? 'My LGA group' : 'Groups', icon: MapPin, to: lgaGroup ? `/subgroups/${lgaGroup}` : '/subgroups' },
        { label: 'Contests', icon: Vote, to: '/contests' },
        { label: 'Polls', icon: BarChart3, to: '/polls' },
        { label: 'Events', icon: CalendarDays, to: '/events' },
        { label: 'Leaderboard', icon: Trophy, to: '/leaderboard' },
        { label: 'Jobs and services', icon: Briefcase, to: '/opportunities' },
      ],
    },
    {
      title: 'Inbox',
      items: [
        { label: 'Messages', icon: Mail, to: '/messages', badge: unreadMessages },
        { label: 'Calls', icon: Phone, tab: 'calls' },
        { label: 'Notifications', icon: Bell, to: '/notifications' },
      ],
    },
    { title: 'Account', items: [{ label: 'Settings', icon: SettingsIcon, tab: 'settings' }] },
  ]

  const navClass = (active: boolean) =>
    `w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60'
    }`
  const pillClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
    }`

  return (
    <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)] gap-6">
      <SEO title="Your Dashboard" description="Manage your page and take part in the AbiaConnect community." path="/dashboard" />
      {/* Menu - desktop */}
      <aside className="hidden lg:block">
        <nav className="rounded-2xl border border-border bg-card p-3 sticky top-24 space-y-3" aria-label="Dashboard">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="mb-1 px-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
              {g.items.map((n) =>
                n.to ? (
                  <Link key={n.label} to={n.to} className={navClass(false)}>
                    <n.icon className="size-4" /> {n.label}
                    {n.badge ? <span className="ml-auto rounded-full bg-primary/10 px-2 text-xs font-bold text-primary">{n.badge}</span> : null}
                  </Link>
                ) : (
                  <button key={n.label} type="button" onClick={() => setTab(n.tab!)} className={navClass(tab === n.tab)}>
                    <n.icon className="size-4" /> {n.label}
                  </button>
                ),
              )}
            </div>
          ))}
          <button type="button" onClick={handleSignOut} className={navClass(false)}>
            <LogOut className="size-4" /> Sign Out
          </button>
        </nav>
      </aside>

      {/* Menu - small screens */}
      <div className="lg:hidden -mx-3 px-3 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {groups.flatMap((g) => g.items).map((n) =>
            n.to ? (
              <Link key={n.label} to={n.to} className={pillClass(false)}>
                {n.label}
              </Link>
            ) : (
              <button key={n.label} type="button" onClick={() => setTab(n.tab!)} className={pillClass(tab === n.tab)}>
                {n.label}
              </button>
            ),
          )}
          <button type="button" onClick={handleSignOut} className={pillClass(false)}>
            Sign Out
          </button>
        </div>
      </div>

      <main className="min-w-0">
        {tab === 'overview' ? (
          <Overview
            userId={user?.id ?? ''}
            displayName={displayName}
            profile={profile}
            stats={statsQ.data}
            followers={summaryQ.data?.followers ?? 0}
            chartData={chartData}
            recentThreads={recentQ.data}
          />
        ) : (
          <TabPanel tab={tab} profile={profile} onSaved={() => profileQ.refetch()} onDeleted={() => qc.invalidateQueries({ queryKey: ['my-threads'] })} />
        )}
      </main>
    </div>
  )
}

/* ----------------- Tabs other than the overview ----------------- */
function TabPanel({ tab, profile, onSaved, onDeleted }: { tab: Tab; profile: Profile; onSaved: () => void; onDeleted: () => void }) {
  return (
    <>
      {tab === 'posts' && <MyPosts onDeleted={onDeleted} />}
      {tab === 'saved' && <SavedPosts />}
      {tab === 'messages' && (
        <LinkCard to="/messages" label="Open Messages" description="View and reply to your conversations." icon={Mail} />
      )}
      {tab === 'calls' && (
        <Suspense fallback={<div className="text-sm text-slate-300/70">Loading call history…</div>}>
          <CallHistory />
        </Suspense>
      )}
      {tab === 'notifications' && (
        <LinkCard to="/notifications" label="Open Notifications" description="See your latest alerts." icon={Bell} />
      )}
      {tab === 'settings' && <SettingsPanel profile={profile} onSaved={onSaved} />}
    </>
  )
}

/* ----------------- Overview ----------------- */
function Overview({ userId, displayName, profile, stats, followers, chartData, recentThreads }: {
  userId: string
  displayName: string
  profile: Profile
  stats?: any
  followers: number
  chartData: any[]
  recentThreads?: any[]
}) {
  const contests = useQuery({ queryKey: ['contests'], queryFn: listContests, staleTime: 60_000 })
  const open = (contests.data ?? []).map((c) => ({ ...c, phase: contestPhase(c) })).filter((c) => c.phase === 'open')
  const cards = [
    { label: 'My Posts', value: stats?.posts ?? 0 },
    { label: 'Replies', value: stats?.replies ?? 0 },
    { label: 'Reputation', value: stats?.reputation ?? 0 },
    { label: 'Followers', value: followers },
    { label: 'Saved', value: stats?.bookmarks ?? 0 },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-5">
        {/* My page */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-24 px-5 py-3 font-serif text-white/90" style={{ backgroundImage: APP_HEADER_GRADIENT }}>
            Connecting Abians worldwide
          </div>
          <div className="px-5 pb-5">
            <div className="-mt-9 flex flex-wrap items-end gap-x-4 gap-y-3">
              <UserAvatar avatarUrl={profile.avatar_url} displayName={displayName} size="xl" className="size-24 border-4 border-card" />
              <div className="min-w-[12rem] flex-1">
                <h1 className="text-2xl font-bold leading-tight">Welcome back, {displayName}!</h1>
                <p className="text-sm text-muted-foreground">{[profile.username ? `@${profile.username}` : null, profile.lga].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link to={`/member/${userId}`}>
                    <Eye className="size-4" /> View my public page
                  </Link>
                </Button>
                <Button asChild className="rounded-full">
                  <Link to="/profile">
                    <Pencil className="size-4" /> Edit my page
                  </Link>
                </Button>
              </div>
            </div>
            <PageProgressBar profile={profile as Record<string, unknown>} className="mt-4" />
          </div>
        </section>

        <BirthdayGreeting />
        <BirthdaysTodayCard />
        <AddBirthdayPrompt />

        {/* Announcements and promotions (managed by admins) */}
        <HeroSlider compact />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs font-semibold text-muted-foreground">{c.label}</div>
              <div className="mt-1 font-serif text-2xl font-bold">{c.value}</div>
            </div>
          ))}
        </div>

        {/* The main forum, without leaving the dashboard */}
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card px-4 pt-4">
            <h2 className="text-lg font-semibold">From your community</h2>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/create-thread">
                <PenSquare className="size-4" /> Start a discussion
              </Link>
            </Button>
          </div>
          <CommunityFeed pageSize={5} moreLink={{ to: '/', label: 'Open the full forum' }} />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-bold">Recent Activity</h2>
            <div className="h-56">
              <Suspense fallback={<div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />}>
                <ActivityChart data={chartData} />
              </Suspense>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-bold">My Recent Threads</h2>
            {!recentThreads?.length ? (
              <p className="text-sm text-muted-foreground">No threads yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentThreads.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <Link to={`/thread/${t.id}`} className="text-sm font-medium hover:text-primary truncate">
                      {t.title}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <JoinInTodayCard />
        <DailyRewardCard />
        <WaitingForReplyCard />
        <QuestionOfTheDayCard />
        {open.length ? (
          <CollapsibleCard
            name="Vote now"
            title="Vote now"
            action={
              <Link to="/contests" className="shrink-0 text-sm font-semibold text-primary">
                All contests
              </Link>
            }
          >
            <ul className="space-y-1.5">
              {open.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <Link to={`/contests/${c.id}`} className="block text-sm font-semibold hover:text-primary">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleCard>
        ) : null}
        <LgaOfTheMonthCard />
        <OpportunitiesCard />
        <InviteCard />
      </aside>
    </div>
  )
}

/* ----------------- My Posts ----------------- */
function MyPosts({ onDeleted }: { onDeleted: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['my-threads', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('id, title, created_at, categories(name), replies(count)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      // Fetch content first so we can clean up any uploaded images from storage.
      const { data: row } = await supabase
        .from('threads')
        .select('content')
        .eq('id', id)
        .maybeSingle()
      const paths = extractAttachmentPaths((row as { content?: string } | null)?.content)
      const { error } = await supabase.from('threads').delete().eq('id', id)
      if (error) throw error
      if (paths.length) await deleteAttachmentPaths(paths)
    },
    onSuccess: () => {
      toast.success('Thread deleted')
      qc.invalidateQueries({ queryKey: ['my-threads'] })
      onDeleted()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  })

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  const items = (q.data ?? []) as Array<{
    id: string
    title: string
    created_at: string
    categories?: { name?: string | null } | null
    replies?: { count: number }[]
  }>
  if (!items.length) return <p className="text-sm text-muted-foreground">You haven't posted yet.</p>

  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0">
            <Link to={`/thread/${t.id}`} className="font-medium hover:text-primary">{t.title}</Link>
            <div className="text-xs text-muted-foreground mt-1">
              {t.categories?.name && <span className="mr-2">in {t.categories.name}</span>}
              {format(new Date(t.created_at), 'PPP')} · {t.replies?.[0]?.count ?? 0} replies
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)} aria-label="Delete">
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

/* ----------------- Saved ----------------- */
function SavedPosts() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('id, thread_id, threads(id, title, categories(name))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookmarks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  })

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  const items = (q.data ?? []) as unknown as Array<{
    id: string
    thread_id: string
    threads?: { id: string; title: string; categories?: { name?: string | null } | null } | null
  }>
  if (!items.length) return <p className="text-sm text-muted-foreground">No saved posts yet.</p>

  return (
    <ul className="space-y-3">
      {items.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <Link to={`/thread/${b.threads?.id ?? b.thread_id}`} className="block font-medium hover:text-primary truncate">
              {b.threads?.title ?? 'Thread'}
            </Link>
            {b.threads?.categories?.name && (
              <div className="text-xs text-muted-foreground truncate">in {b.threads.categories.name}</div>
            )}
          </div>
          <Button size="sm" variant="ghost" className="shrink-0" onClick={() => remove.mutate(b.id)}>Remove</Button>
        </li>
      ))}
    </ul>
  )
}

/* ----------------- Settings ----------------- */
function SettingsPanel({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    display_name: profile.display_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    lga: profile.lga ?? '',
  })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [uploading, setUploading] = useState(false)
  const [callsOn, setCallsOn] = useState(areCallsEnabled())

  useEffect(() => subscribeCallsEnabled(setCallsOn), [])

  useEffect(() => {
    if (user?.id) void hydrateCallsEnabledFromProfile(user.id)
  }, [user?.id])

  useEffect(() => {
    setForm({
      display_name: profile.display_name ?? '',
      username: profile.username ?? '',
      bio: profile.bio ?? '',
      lga: profile.lga ?? '',
    })
  }, [profile.display_name, profile.username, profile.bio, profile.lga])

  const save = async () => {
    if (!user) return
    const { error } = await saveProfile(user.id, form)
    if (error) return toast.error(error.message)
    toast.success('Profile updated')
    onSaved()
  }

  const updatePassword = async () => {
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return toast.error(error.message)
    setPassword('')
    toast.success('Password updated')
  }

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    const webp = await toWebP(file)
    const ext = webp.name.split('.').pop() || 'webp'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { uploadAndScan } = await import('@/lib/scanAttachment')
    const res = await uploadAndScan('avatars', path, webp, {
      contentType: webp.type,
      upsert: true,
    })
    if (!res.uploaded) {
      setUploading(false)
      return toast.error(res.error || 'Avatar blocked by security scan')
    }
    const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id)
    setUploading(false)
    if (error) return toast.error(error.message)
    toast.success('Avatar updated')
    onSaved()
  }

  const deleteAccount = async () => {
    if (confirm !== 'DELETE' || !user) return
    // Deletes the sign-in account and all linked data on the server.
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } })
    if (error) return toast.error('Could not delete your account. Please try again or contact support@abiaconnect.com.')
    await signOut()
    toast.success('Account deleted')
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">Profile</h2>

        <div className="flex items-center gap-4">
          <UserAvatar avatarUrl={profile.avatar_url} displayName={form.display_name || user?.email || 'User'} size="lg" className="h-16 w-16" />
          <label className="text-sm">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <span className="inline-block cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 hover:bg-muted">
              {uploading ? 'Uploading…' : 'Change avatar'}
            </span>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Display Name</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <BioField
              value={form.bio}
              onChange={(v: string) => setForm({ ...form, bio: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>LGA</Label>
            <Input value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} />
          </div>
        </div>
        <Button onClick={save} disabled={!profile.id}>
          Save Changes
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">Notifications</h2>
        <NotificationSoundToggle />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">Calls</h2>
        <p className="text-sm text-muted-foreground">
          Turn voice calling on or off on this device. When off, you can't start calls and incoming calls are declined automatically.
        </p>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${callsOn ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
              {callsOn ? <Phone className="h-5 w-5" /> : <PhoneOff className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold">Voice calls</p>
              <p className="text-xs text-muted-foreground">
                {callsOn ? 'Enabled — you can make and receive calls' : 'Disabled — calls are blocked'}
              </p>
            </div>
          </div>
          <Switch
            checked={callsOn}
            onCheckedChange={(v) => {
              void setCallsEnabled(v, { userId: user?.id })
              toast.success(v ? 'Calls turned on' : 'Calls turned off')
            }}
            aria-label="Toggle voice calls"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">App</h2>
        <NativeAppDownload />
        
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">Change Password</h2>
        <PasswordInput
          autoComplete="new-password"
          placeholder="New password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button variant="secondary" onClick={updatePassword}>Update Password</Button>
      </section>

      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
        <h2 className="font-bold text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Type <strong>DELETE</strong> below to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirm('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirm !== 'DELETE'}
                onClick={deleteAccount}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}

/* ----------------- Helpers ----------------- */
function LinkCard({
  to,
  label,
  description,
  icon: Icon,
}: {
  to: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
      <Icon className="size-8 mx-auto text-primary" />
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button asChild>
        <Link to={to}>{label}</Link>
      </Button>
    </div>
  )
}
