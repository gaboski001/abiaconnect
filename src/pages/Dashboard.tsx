import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { toWebP } from '@/lib/image'
import { Link, useNavigate } from 'react-router-dom'
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
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton'
import { PWAPromptToggle } from '@/components/pwa/PWAPromptToggle'

type Tab = 'overview' | 'posts' | 'saved' | 'messages' | 'notifications' | 'settings'

const NAV: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'posts', label: 'My Posts', icon: FileText },
  { id: 'saved', label: 'Saved Posts', icon: Bookmark },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
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
  const profile = profileQ.data ?? {}
  const displayName = profile.display_name || user?.email?.split('@')[0] || 'You'

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="grid lg:grid-cols-[16rem_1fr] gap-6">
      <SEO title="Your Dashboard" description="Track your posts, replies, bookmarks, and reputation on AbiaConnect." path="/dashboard" />
      {/* Sidebar - desktop */}
      <aside className="hidden lg:block">
        <div className="rounded-2xl border border-border bg-card p-5 sticky top-24 space-y-4">
          <div className="flex flex-col items-center text-center gap-2">
            <UserAvatar avatarUrl={profile.avatar_url} displayName={displayName} size="xl" />
            <div>
              <div className="font-bold">{displayName}</div>
              {profile.username && (
                <div className="text-xs text-muted-foreground">@{profile.username}</div>
              )}
            </div>
            <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-semibold">
              {role}
            </span>
          </div>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const active = tab === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors border-l-4 ${
                    active
                      ? 'border-secondary bg-muted text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </button>
              )
            })}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 border-l-4 border-transparent"
            >
              <LogOut className="size-4" /> Sign Out
            </button>
          </nav>
        </div>
      </aside>

      {/* Mobile tabs */}
      <div className="lg:hidden -mx-3 px-3 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border ${
                tab === n.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <main className="min-w-0">
        {tab === 'overview' && <Overview displayName={displayName} />}
        {tab === 'posts' && <MyPosts onDeleted={() => qc.invalidateQueries({ queryKey: ['my-threads'] })} />}
        {tab === 'saved' && <SavedPosts />}
        {tab === 'messages' && (
          <LinkCard to="/messages" label="Open Messages" description="View and reply to your conversations." icon={Mail} />
        )}
        {tab === 'notifications' && (
          <LinkCard to="/notifications" label="Open Notifications" description="See your latest alerts." icon={Bell} />
        )}
        {tab === 'settings' && <SettingsPanel profile={profile} onSaved={() => profileQ.refetch()} />}
      </main>
    </div>
  )
}

/* ----------------- Overview ----------------- */
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

  // Realtime: refresh stats/activity/recent when the user's data changes
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
    { label: 'My Posts', value: stats.data?.posts ?? 0 },
    { label: 'Replies', value: stats.data?.replies ?? 0 },
    { label: 'Reputation', value: stats.data?.reputation ?? 0 },
    { label: 'Bookmarks', value: stats.data?.bookmarks ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome back, {displayName}!</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold mb-4">Recent Activity</h2>
        <div className="h-56">
          <Suspense fallback={<div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />}>
            <ActivityChart data={chartData} />
          </Suspense>
        </div>

      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-bold mb-4">My Recent Threads</h2>
        {recent.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !recent.data?.length ? (
          <p className="text-sm text-muted-foreground">No threads yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.data.map((t) => (
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
        <h2 className="font-bold">App</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Install AbiaConnect</p>
            <p className="text-xs text-muted-foreground">Add to your home screen for quick, offline access</p>
          </div>
          <PWAInstallButton />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">Change Password</h2>
        <Input
          type="password"
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
