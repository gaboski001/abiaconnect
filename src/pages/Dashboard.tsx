import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow, startOfDay, subDays, format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Bell,
  Bookmark,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquareText,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { CallRingtoneSettings } from '@/components/notifications/CallRingtoneSettings'
import { NativeAppDownload } from '@/components/pwa/NativeAppDownload'
import { toWebP } from '@/lib/image'
import { BLUE_GOLD_GRADIENT, GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

const ActivityChart = lazy(() => import('@/components/dashboard/ActivityChart'))

type Tab = 'overview' | 'posts' | 'saved' | 'messages' | 'notifications' | 'settings'

const NAV: Array<{ id: Tab; label: string; mobileLabel: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Home', icon: LayoutDashboard },
  { id: 'posts', label: 'My Posts', mobileLabel: 'Posts', icon: FileText },
  { id: 'saved', label: 'Saved', mobileLabel: 'Saved', icon: Bookmark },
  { id: 'messages', label: 'Messages', mobileLabel: 'Inbox', icon: Mail },
  { id: 'notifications', label: 'Notifications', mobileLabel: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', mobileLabel: 'Settings', icon: SettingsIcon },
]

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
  const [tab, setTab] = useState<Tab>('overview')

  const [cachedProfile, setCachedProfile] = useState<Profile>(() => {
    try {
      const raw = localStorage.getItem(`abia_profile_${user?.id}`)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const profileQ = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    initialData: Object.keys(cachedProfile).length > 0 ? cachedProfile : undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      const result = (row ?? {}) as Profile
      if (user?.id) localStorage.setItem(`abia_profile_${user.id}`, JSON.stringify(result))
      setCachedProfile(result)
      return result
    },
  })

  const profile = profileQ.data || cachedProfile || {}
  const displayName = profile.display_name || user?.email?.split('@')[0] || 'You'
  const heroSubtitle = profile.lga ? `Representing ${profile.lga}` : 'Connecting Abians Worldwide'

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="relative pb-24 lg:pb-0">
      <SEO title="Your Dashboard" description="Track your posts, replies, bookmarks, and reputation on AbiaConnect." path="/dashboard" />

      <div className="absolute inset-x-0 top-0 -z-10 h-80 rounded-[2rem] blur-3xl opacity-40" style={{ background: 'radial-gradient(circle at top, rgba(28,169,217,0.28), transparent 55%), radial-gradient(circle at 70% 20%, rgba(248,195,1,0.22), transparent 42%)' }} />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0B1424] p-5 text-white shadow-2xl sm:p-6" style={{ boxShadow: PREMIUM_SHADOW }}>
        <div className="absolute inset-0 opacity-90" style={{ background: 'linear-gradient(135deg, rgba(7,17,31,0.96) 15%, rgba(12,24,43,0.94) 46%, rgba(9,18,32,0.98) 100%)' }} />
        <div className="absolute -right-16 top-[-3rem] h-48 w-48 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.20)' }} />
        <div className="absolute left-[-4rem] top-16 h-44 w-44 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.18)' }} />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-[1.8rem] blur-2xl" style={{ background: 'rgba(248,195,1,0.25)' }} />
              <div className="relative rounded-[1.8rem] border border-white/10 bg-white/10 p-2.5 backdrop-blur-xl">
                <UserAvatar avatarUrl={profile.avatar_url} displayName={displayName} size="xl" className="h-20 w-20 border border-white/15" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200/76" style={{ background: GOLD_GRADIENT_SOFT }}>
                <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                Your AbiaConnect profile
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Welcome back, {displayName}</h1>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/70">{heroSubtitle}</p>
                {profile.bio?.trim() ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/85 sm:text-base">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300/70 sm:text-base italic">
                    Add a short bio so fellow Abians know who you are and what you contribute to the community.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-slate-100">{role}</span>
                {profile.username ? <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-slate-300/86">@{profile.username}</span> : null}
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">Realtime sync ready</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <HeroAction to="/messages" icon={MessageSquareText} label="Messages" description="Reply faster" />
            <HeroAction to="/notifications" icon={Bell} label="Alerts" description="Stay updated" />
            <HeroAction to="/profile" icon={UserRound} label="Profile" description="Review identity" />
            <button
              onClick={handleSignOut}
              className="flex min-w-[10rem] items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10"><LogOut className="size-4" /></span>
              <span>
                <span className="block">Sign out</span>
                <span className="block text-xs font-medium text-slate-300/72">Back to onboarding</span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4 rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-4 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
            <div className="rounded-[1.6rem] border border-white/10 p-4" style={{ background: BLUE_GOLD_GRADIENT }}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-950/72">Dashboard control</p>
              <h2 className="mt-3 text-xl font-black text-slate-950">Everything important, one tap away</h2>
              <p className="mt-2 text-sm leading-6 text-slate-950/76">
                Jump between discussions, saved posts, direct messages, alerts, and settings with a cleaner native-style sidebar.
              </p>
            </div>
            <nav className="space-y-2">
              {NAV.map((n) => {
                const active = tab === n.id
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={`flex w-full items-center gap-3 rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition ${active ? 'text-slate-950' : 'text-slate-200/82 hover:bg-white/[0.06]'}`}
                    style={active ? { backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW } : undefined}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? 'bg-black/10' : 'bg-white/[0.06]'}`}>
                      <n.icon className="size-4" />
                    </span>
                    <span className="flex-1 text-left">{n.label}</span>
                    <ChevronRight className="size-4 opacity-70" />
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <div className="space-y-4 lg:hidden">
          <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,18,32,0.92)] p-2 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
            <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
              <div className="flex gap-2 pb-1">
                {NAV.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition"
                    style={tab === n.id ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, borderColor: 'transparent', boxShadow: GOLD_SHADOW } : { background: 'rgba(255,255,255,0.06)', color: '#F8FAFC', borderColor: 'rgba(255,255,255,0.12)' }}
                  >
                    {n.mobileLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <main className="min-w-0">
          {tab === 'overview' && <Overview displayName={displayName} />}
          {tab === 'posts' && <MyPosts onDeleted={() => qc.invalidateQueries({ queryKey: ['my-threads'] })} />}
          {tab === 'saved' && <SavedPosts />}
          {tab === 'messages' && <LinkCard to="/messages" label="Open Messages" description="Jump into direct conversations with a more focused native card layout." icon={Mail} />}
          {tab === 'notifications' && <LinkCard to="/notifications" label="Open Notifications" description="Review the latest mentions, replies, and system alerts from one place." icon={Bell} />}
          {tab === 'settings' && <SettingsPanel profile={profile} onSaved={() => profileQ.refetch()} />}
        </main>
      </div>

    </div>
  )
}

function HeroAction({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: string
  icon: ComponentType<{ className?: string }>
  label: string
  description: string
}) {
  return (
    <Link to={to} className="flex min-w-[10rem] items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:bg-white/10">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10"><Icon className="size-4" /></span>
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-xs font-medium text-slate-300/72">{description}</span>
      </span>
    </Link>
  )
}

function Overview({ displayName }: { displayName: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const stats = useQuery({
    queryKey: ['dash-stats', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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

  const activity = useQuery({
    queryKey: ['dash-activity', user?.id],
    enabled: !!user,
    staleTime: 30_000,
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

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)))
    const counts = new Map(days.map((d) => [format(d, 'yyyy-MM-dd'), 0]))
    for (const row of activity.data ?? []) {
      const key = format(startOfDay(new Date(row.created_at)), 'yyyy-MM-dd')
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return days.map((d) => ({
      label: format(d, 'EEE'),
      posts: counts.get(format(d, 'yyyy-MM-dd')) ?? 0,
    }))
  }, [activity.data])

  const recent = useQuery({
    queryKey: ['my-recent-threads', user?.id],
    enabled: !!user,
    staleTime: 30_000,
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

  useEffect(() => {
    if (!user) return
    const uid = user.id
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['dash-stats', uid] })
      qc.invalidateQueries({ queryKey: ['dash-activity', uid] })
      qc.invalidateQueries({ queryKey: ['my-recent-threads', uid] })
    }
    const channel = supabase
      .channel(`dash-overview:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads', filter: `user_id=eq.${uid}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replies', filter: `user_id=eq.${uid}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookmarks', filter: `user_id=eq.${uid}` }, invalidate)
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, qc])

  const cards = [
    { label: 'Posts', value: stats.data?.posts ?? 0, icon: FileText, accent: 'rgba(28,169,217,0.18)' },
    { label: 'Replies', value: stats.data?.replies ?? 0, icon: MessageSquareText, accent: 'rgba(248,195,1,0.16)' },
    { label: 'Reputation', value: stats.data?.reputation ?? 0, icon: TrendingUp, accent: 'rgba(52,211,153,0.14)' },
    { label: 'Bookmarks', value: stats.data?.bookmarks ?? 0, icon: Bookmark, accent: 'rgba(232,112,21,0.16)' },
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Your AbiaConnect hub</p>
              <h2 className="mt-2 text-2xl font-black text-white">Stay close to your community</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300/72">
                Welcome back, {displayName}. Track your contributions across Abia's 17 LGAs, follow live discussions, and respond to neighbours, leaders, and groups you care about — all from one place.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 px-4 py-3 text-sm text-slate-300/74" style={{ background: GOLD_GRADIENT_SOFT }}>
              <span className="font-semibold text-white">Tip:</span> jump into Messages or Notifications to keep conversations with your LGA moving in real time.
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-[1.5rem] border border-white/10 p-4" style={{ background: `linear-gradient(180deg, ${c.accent}, rgba(255,255,255,0.02))` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{c.label}</div>
                    <div className="mt-2 text-3xl font-black text-white">{c.value}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
                    <c.icon className="size-5 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 p-5 text-slate-950" style={{ background: BLUE_GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-950/70">Your AbiaConnect hub</p>
          <h3 className="mt-2 text-2xl font-black">Everything that matters, in one place</h3>
          <p className="mt-3 text-sm leading-6 text-slate-950/76">
            Track your conversations, contributions and community reach across Abia State's 17 LGAs — without leaving your dashboard.
          </p>
          <div className="mt-5 space-y-3">
            {[
              'Pick up unread messages and replies the moment they arrive',
              'Manage your profile, privacy and notification preferences in one tap',
              'Follow your threads, bookmarks and reputation as they grow',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-black/8 px-3 py-3 text-sm font-medium text-slate-950/82">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">Posting activity</h3>
              <p className="text-sm text-slate-300/68">The last 7 days of thread creation activity.</p>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300/74">Live refresh</div>
          </div>
          <div className="h-64 rounded-[1.4rem] border border-white/8 bg-black/12 p-2">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-[1.2rem] bg-white/5" />}>
              <ActivityChart data={chartData} />
            </Suspense>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">Recent threads</h3>
              <p className="text-sm text-slate-300/68">Your latest discussions, ready to reopen.</p>
            </div>
            <Link to="/" className="text-sm font-semibold" style={{ color: MOBILE_BRAND.gold }}>
              Explore forum
            </Link>
          </div>

          {recent.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((row) => <div key={row} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
            </div>
          ) : !recent.data?.length ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.03] p-5 text-center">
              <AlertCircle className="mx-auto size-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-300/72">No threads yet. Start a new conversation and your recent activity will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {recent.data.map((t) => (
                <li key={t.id} className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/thread/${t.id}`} className="line-clamp-2 text-sm font-semibold text-white hover:opacity-80">
                        {t.title}
                      </Link>
                      <p className="mt-2 text-xs text-slate-400">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

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
      const { error } = await supabase.from('threads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Thread deleted')
      qc.invalidateQueries({ queryKey: ['my-threads'] })
      onDeleted()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  })

  if (q.isLoading) return <PanelState label="Loading your posts…" />
  const items = (q.data ?? []) as Array<{
    id: string
    title: string
    created_at: string
    categories?: { name?: string | null } | null
    replies?: { count: number }[]
  }>
  if (!items.length) return <PanelState label="You have not posted yet. Start your first discussion to populate this screen." />

  return (
    <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">My posts</h2>
          <p className="text-sm text-slate-300/68">Manage every thread you created from a cleaner, card-based list.</p>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
            <div className="min-w-0">
              <Link to={`/thread/${t.id}`} className="font-semibold text-white hover:opacity-80">{t.title}</Link>
              <div className="mt-2 text-xs text-slate-400">
                {t.categories?.name && <span className="mr-2">in {t.categories.name}</span>}
                {format(new Date(t.created_at), 'PPP')} · {t.replies?.[0]?.count ?? 0} replies
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)} aria-label="Delete" className="rounded-2xl text-slate-300 hover:bg-white/10 hover:text-white">
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

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

  if (q.isLoading) return <PanelState label="Loading your saved posts…" />
  const items = (q.data ?? []) as unknown as Array<{
    id: string
    thread_id: string
    threads?: { id: string; title: string; categories?: { name?: string | null } | null } | null
  }>
  if (!items.length) return <PanelState label="No saved posts yet. Bookmark important threads and they will appear here." />

  return (
    <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
      <div className="mb-4">
        <h2 className="text-lg font-black text-white">Saved posts</h2>
        <p className="text-sm text-slate-300/68">Your personal reading list in a cleaner mobile layout.</p>
      </div>
      <ul className="space-y-3">
        {items.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
            <div className="min-w-0 flex-1">
              <Link to={`/thread/${b.threads?.id ?? b.thread_id}`} className="block truncate font-semibold text-white hover:opacity-80">
                {b.threads?.title ?? 'Thread'}
              </Link>
              {b.threads?.categories?.name ? <div className="mt-1 text-xs text-slate-400 truncate">in {b.threads.categories.name}</div> : null}
            </div>
            <Button size="sm" variant="ghost" className="shrink-0 rounded-2xl text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => remove.mutate(b.id)}>Remove</Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

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
    const { error } = await supabase.from('profiles').delete().eq('id', user.id)
    if (error) return toast.error(error.message)
    await signOut()
    toast.success('Account deleted')
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">Profile settings</h2>
        <p className="mt-1 text-sm text-slate-300/68">Edit how you appear across the community while keeping the mobile form cleaner and easier to scan.</p>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar avatarUrl={profile.avatar_url} displayName={form.display_name || user?.email || 'User'} size="lg" className="h-20 w-20 border border-white/15" />
          <label className="text-sm">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <span className="inline-flex cursor-pointer items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 font-semibold text-slate-100 hover:bg-white/[0.08]">
              {uploading ? 'Uploading…' : 'Change avatar'}
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Display name"><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" /></Field>
          <Field label="Username"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" /></Field>
          <div className="sm:col-span-2">
            <BioField value={form.bio} onChange={(v: string) => setForm({ ...form, bio: v })} />
          </div>
          <Field label="LGA"><Input value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" /></Field>
        </div>
        <Button onClick={save} disabled={!profile.id} className="mt-5 rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
          Save changes
        </Button>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">Notifications</h2>
        <p className="mt-1 text-sm text-slate-300/68">Choose how your device alerts you without losing the premium Android feel.</p>
        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          <NotificationSoundToggle />
        </div>
        <div className="mt-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          <CallRingtoneSettings />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">App tools</h2>
        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
          <NativeAppDownload />
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-5 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
        <h2 className="text-lg font-black text-white">Change password</h2>
        <div className="mt-4 space-y-3">
          <Input type="password" placeholder="New password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-2xl border-white/10 bg-slate-950/40 text-white" />
          <Button variant="secondary" onClick={updatePassword} className="rounded-2xl">Update password</Button>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-rose-400/25 bg-rose-400/8 p-5 backdrop-blur-2xl">
        <h2 className="text-lg font-black text-rose-200">Danger zone</h2>
        <p className="mt-1 text-sm text-rose-100/76">Permanently delete your account and associated data.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4 rounded-2xl">Delete account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. Type <strong>DELETE</strong> below to confirm.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirm('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={confirm !== 'DELETE'} onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}

function LinkCard({
  to,
  label,
  description,
  icon: Icon,
}: {
  to: string
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-6 text-center backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-white/8">
        <Icon className="size-6 text-white" />
      </div>
      <h2 className="mt-4 text-lg font-black text-white">{label}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300/72">{description}</p>
      <Button asChild className="mt-5 rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
        <Link to={to}>{label}</Link>
      </Button>
    </div>
  )
}

function PanelState({ label }: { label: string }) {
  return (
    <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,18,32,0.82)] p-6 text-center text-sm text-slate-300/72 backdrop-blur-2xl" style={{ boxShadow: PREMIUM_SHADOW }}>
      {label}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300/76">{label}</Label>
      {children}
    </div>
  )
}
