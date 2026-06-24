import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, startOfDay, subDays, format } from 'date-fns'
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
import { Capacitor } from '@capacitor/core'
import { NativeAppDownload } from '@/components/pwa/NativeAppDownload'
import { toWebP } from '@/lib/image'

// Lazy load chart only on desktop
const ActivityChart = lazy(() => import('@/components/dashboard/ActivityChart'))

type Tab = 'overview' | 'posts' | 'saved' | 'messages' | 'notifications' | 'settings'

const NAV: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'posts', label: 'My Posts', icon: FileText },
  { id: 'saved', label: 'Saved Posts', icon: Bookmark },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

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
      return row || {}
    },
  })

  const profile = profileQ.data || {}
  const displayName = profile.display_name || user?.email?.split('@')[0] || 'User'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <SEO title="User Dashboard | AbiaConnect" description="Manage your AbiaConnect profile, posts, and notifications." path="/dashboard" />

      {/* Dashboard Navigation */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm lg:sticky lg:top-24">
          <div className="flex flex-col items-center text-center gap-3 mb-8">
            <UserAvatar avatarUrl={profile.avatar_url} displayName={displayName} size="xl" className="ring-4 ring-primary/10" />
            <div>
              <div className="font-bold text-lg tracking-tight">{displayName}</div>
              {profile.username && <div className="text-sm text-muted-foreground">@{profile.username}</div>}
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              {role}
            </span>
          </div>

          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible -mx-2 px-2 lg:mx-0 lg:px-0 scrollbar-none pb-4 lg:pb-0">
            {NAV.map((n) => {
              const Icon = n.icon
              const active = tab === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {n.label}
                </button>
              )
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-all mt-4"
            >
              <LogOut className="size-4 shrink-0" /> Sign Out
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <div className="bg-card border border-border rounded-3xl p-6 lg:p-8 shadow-sm min-h-[400px]">
          {tab === 'overview' && <OverviewSection displayName={displayName} />}
          {tab === 'posts' && <MyPostsSection />}
          {tab === 'saved' && <SavedPostsSection />}
          {tab === 'messages' && <LinkCard to="/messages" title="Your Conversations" desc="View and reply to your private messages." icon={Mail} />}
          {tab === 'notifications' && <LinkCard to="/notifications" title="Recent Alerts" desc="Stay updated with your latest community activity." icon={Bell} />}
          {tab === 'settings' && <SettingsSection profile={profile} onSaved={() => profileQ.refetch()} />}
        </div>
      </main>
    </div>
  )
}

/* ----------------- SECTIONS ----------------- */

function OverviewSection({ displayName }: { displayName: string }) {
  const { user } = useAuth()

  const stats = useQuery({
    queryKey: ['dash-stats', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id
      const [posts, replies, bookmarks, prof] = await Promise.all([
        supabase.from('threads').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('replies').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('profiles').select('reputation').eq('id', uid).maybeSingle(),
      ])
      return {
        posts: posts.count || 0,
        replies: replies.count || 0,
        bookmarks: bookmarks.count || 0,
        reputation: prof.data?.reputation || 0,
      }
    },
  })

  const activity = useQuery({
    queryKey: ['dash-activity', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = startOfDay(subDays(new Date(), 6)).toISOString()
      const { data } = await supabase.from('threads').select('created_at').eq('user_id', user!.id).gte('created_at', since)
      return data || []
    },
  })

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)))
    const map = new Map(days.map(d => [format(d, 'yyyy-MM-dd'), 0]))
    for (const r of activity.data || []) {
      const k = format(new Date(r.created_at), 'yyyy-MM-dd')
      if (map.has(k)) map.set(k, (map.get(k) || 0) + 1)
    }
    return days.map(d => ({ label: format(d, 'EEE'), posts: map.get(format(d, 'yyyy-MM-dd')) || 0 }))
  }, [activity.data])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome back, {displayName}!</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your activity on AbiaConnect.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'My Posts', val: stats.data?.posts },
          { label: 'Replies', val: stats.data?.replies },
          { label: 'Reputation', val: stats.data?.reputation },
          { label: 'Saved', val: stats.data?.bookmarks },
        ].map(s => (
          <div key={s.label} className="bg-background/50 border border-border p-5 rounded-2xl shadow-sm">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{s.label}</div>
            <div className="text-3xl font-black mt-2 text-primary">{s.val ?? '...'}</div>
          </div>
        ))}
      </div>

      {!Capacitor.isNativePlatform() && (
        <div className="bg-background/50 border border-border p-6 rounded-3xl">
          <h3 className="font-bold mb-6">Recent Activity</h3>
          <div className="h-64">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted rounded-xl" />}>
              <ActivityChart data={chartData} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}

function MyPostsSection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['my-threads', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('threads').select('id, title, created_at, categories(name), replies(count)').eq('user_id', user!.id).order('created_at', { ascending: false })
      return data || []
    },
  })

  const del = useMutation({
    mutationFn: async (id: string) => supabase.from('threads').delete().eq('id', id),
    onSuccess: () => {
      toast.success('Thread deleted')
      qc.invalidateQueries({ queryKey: ['my-threads'] })
    },
  })

  if (q.isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse bg-muted rounded-2xl" />)}</div>

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold mb-6">My Posts</h2>
      {!q.data?.length ? (
        <div className="text-center py-12 text-muted-foreground">You haven't posted any threads yet.</div>
      ) : (
        q.data.map((t: any) => (
          <div key={t.id} className="group flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-background/50 hover:border-primary/30 transition-all">
            <div className="min-w-0">
              <Link to={`/thread/${t.id}`} className="font-bold hover:text-primary transition-colors line-clamp-1">{t.title}</Link>
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                <span className="font-medium text-secondary">in {t.categories?.name}</span>
                <span>•</span>
                <span>{format(new Date(t.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => del.mutate(t.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

function SavedPostsSection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('bookmarks').select('id, thread_id, threads(id, title, categories(name))').eq('user_id', user!.id).order('created_at', { ascending: false })
      return data || []
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => supabase.from('bookmarks').delete().eq('id', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  })

  if (q.isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse bg-muted rounded-2xl" />)}</div>

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold mb-6">Saved Posts</h2>
      {!q.data?.length ? (
        <div className="text-center py-12 text-muted-foreground">You haven't bookmarked any threads yet.</div>
      ) : (
        q.data.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-background/50">
            <div className="min-w-0">
              <Link to={`/thread/${b.threads?.id}`} className="font-bold hover:text-primary line-clamp-1">{b.threads?.title || 'Untitled Thread'}</Link>
              <div className="text-[11px] text-muted-foreground mt-1">Saved bookmark</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)}>Remove</Button>
          </div>
        ))
      )}
    </div>
  )
}

function SettingsSection({ profile, onSaved }: { profile: any, onSaved: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    username: profile.username || '',
    bio: profile.bio || '',
    lga: profile.lga || '',
  })
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    if (!user) return
    const { error } = await saveProfile(user.id, form)
    if (error) return toast.error(error.message)
    toast.success('Profile updated successfully')
    onSaved()
  }

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    try {
      const webp = await toWebP(file)
      const ext = webp.name.split('.').pop() || 'webp'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { uploadAndScan } = await import('@/lib/scanAttachment')
      const res = await uploadAndScan('avatars', path, webp, { contentType: webp.type, upsert: true })
      if (!res.uploaded) return toast.error(res.error || 'Blocked by security scan')
      await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id)
      toast.success('Avatar updated')
      onSaved()
    } catch (e) {
      toast.error('Failed to upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-border">
        <UserAvatar avatarUrl={profile.avatar_url} displayName={form.display_name || 'User'} size="xl" className="h-24 w-24 shadow-xl" />
        <div className="flex flex-col items-center sm:items-start gap-3">
          <h3 className="font-bold text-xl">Profile Picture</h3>
          <label className="cursor-pointer">
            <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
            <Button asChild variant="secondary" className="rounded-xl" disabled={uploading}>
              <span>{uploading ? 'Processing...' : 'Change Photo'}</span>
            </Button>
          </label>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-bold">Display Name</Label>
            <Input value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} className="h-12 rounded-xl bg-background/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">Username</Label>
            <Input value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="h-12 rounded-xl bg-background/50" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold">Bio / About Me</Label>
          <BioField value={form.bio} onChange={v => setForm({...form, bio: v})} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-bold">LGA</Label>
          <Input value={form.lga} onChange={e => setForm({...form, lga: e.target.value})} className="h-12 rounded-xl bg-background/50" />
        </div>
        <Button onClick={save} size="lg" className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 mt-4">
          Save Profile Changes
        </Button>
      </div>

      <div className="pt-10 border-t border-border space-y-6">
        <h3 className="font-black text-xl tracking-tight">App Settings</h3>
        <NotificationSoundToggle />
        <NativeAppDownload />
      </div>
    </div>
  )
}

function LinkCard({ to, title, desc, icon: Icon }: { to: string, title: string, desc: string, icon: any }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-6 animate-in zoom-in-95 duration-500">
      <div className="p-6 rounded-3xl bg-primary/10 text-primary shadow-inner">
        <Icon className="size-12" />
      </div>
      <div>
        <h2 className="text-3xl font-black tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">{desc}</p>
      </div>
      <Button asChild size="lg" className="h-14 px-10 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20">
        <Link to={to}>Open Page</Link>
      </Button>
    </div>
  )
}
