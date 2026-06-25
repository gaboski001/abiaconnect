import { lazy, Suspense, useEffect, useMemo, useState, memo } from 'react'
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
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { saveProfile } from '@/lib/profileUpdate'
import { BioField } from '@/components/profile/BioField'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { NotificationSoundToggle } from '@/components/notifications/NotificationSoundToggle'
import { Capacitor } from '@capacitor/core'
import { NativeAppDownload } from '@/components/pwa/NativeAppDownload'
import { toWebP } from '@/lib/image'

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

type ProfileRow = { display_name?: string | null; avatar_url?: string | null; username?: string | null }
const EMPTY_OBJ: ProfileRow = {}


export default function Dashboard() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')

  const profileQ = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row || EMPTY_OBJ
    },
  })

  const profile = profileQ.data || EMPTY_OBJ
  const displayName = profile.display_name || user?.email?.split('@')[0] || 'User'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="space-y-8">
      <SEO title="User Dashboard | AbiaConnect" description="Manage your AbiaConnect profile and view community activity." path="/dashboard" />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <UserAvatar avatarUrl={profile.avatar_url} displayName={displayName} size="xl" className="h-16 w-16" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Hello, {displayName}!</h1>
            <p className="text-sm text-muted-foreground">@{profile.username || 'abia_member'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-black tracking-widest bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
            {role}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-destructive hover:bg-destructive/10 h-10 px-4 rounded-xl">
            <LogOut className="size-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-[16rem_1fr] gap-8 items-start">
        {/* Navigation Sidebar */}
        <aside className="bg-card border border-border rounded-3xl p-3 shadow-sm lg:sticky lg:top-24">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none">
            {NAV.map((n) => {
              const Icon = n.icon
              const active = tab === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {n.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <section className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm overflow-hidden">
          {tab === 'overview' && <OverviewSection profile={profile} />}
          {tab === 'posts' && <MyPostsSection />}
          {tab === 'saved' && <SavedPostsSection />}
          {tab === 'messages' && <LinkCard to="/messages" title="Messages" desc="Connect privately with other members." icon={Mail} />}
          {tab === 'notifications' && <LinkCard to="/notifications" title="Alerts" desc="Stay updated with replies and mentions." icon={Bell} />}
          {tab === 'settings' && <SettingsSection profile={profile} onSaved={() => profileQ.refetch()} />}
        </section>
      </div>
    </div>
  )
}

/* ----------------- SECTIONS ----------------- */

const OverviewSection = memo(function OverviewSection({ profile }: { profile: any }) {
  const { user } = useAuth()

  const stats = useQuery({
    queryKey: ['dash-stats', user?.id],
    enabled: !!user,
    staleTime: 60000,
    queryFn: async () => {
      const uid = user!.id
      const [posts, replies, bookmarks] = await Promise.all([
        supabase.from('threads').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('replies').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      ])
      return {
        posts: posts.count || 0,
        replies: replies.count || 0,
        bookmarks: bookmarks.count || 0,
        reputation: profile.reputation || 0,
      }
    },
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Threads', val: stats.data?.posts },
          { label: 'Replies', val: stats.data?.replies },
          { label: 'Reputation', val: stats.data?.reputation },
          { label: 'Saved', val: stats.data?.bookmarks },
        ].map(s => (
          <div key={s.label} className="bg-background border border-border p-5 rounded-2xl">
            <div className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{s.label}</div>
            <div className="text-2xl font-black mt-1 text-primary">{s.val ?? '0'}</div>
          </div>
        ))}
      </div>

      <div className="bg-background border border-border p-6 rounded-2xl space-y-4">
        <h3 className="font-bold text-foreground">Your Community Bio</h3>
        <p className="text-sm text-muted-foreground leading-relaxed italic">
          {profile.bio || "You haven't added a bio yet. Head to Settings to tell the community about yourself!"}
        </p>
      </div>

      <div className="bg-primary/5 border border-primary/10 p-6 rounded-2xl flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-bold text-primary truncate">Ready to contribute?</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Start a new discussion or share an update with Abians.</p>
        </div>
        <Button asChild size="sm" className="rounded-full shrink-0 font-bold">
          <Link to="/create-thread">Post Now</Link>
        </Button>
      </div>
    </div>
  )
})

const MyPostsSection = memo(function MyPostsSection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['my-threads', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('threads').select('id, title, created_at, categories(name)').eq('user_id', user!.id).order('created_at', { ascending: false })
      return data || []
    },
  })

  const del = useMutation({
    mutationFn: async (id: string) => supabase.from('threads').delete().eq('id', id),
    onSuccess: () => {
      toast.success('Deleted')
      qc.invalidateQueries({ queryKey: ['my-threads'] })
    },
  })

  if (q.isLoading) return <div className="h-40 flex items-center justify-center animate-pulse text-muted-foreground">Loading your posts...</div>

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-lg font-bold mb-4">My Community Posts</h2>
      {q.data?.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-3xl border-border">
          <p className="text-sm text-muted-foreground">You haven't posted anything yet.</p>
        </div>
      ) : (
        q.data?.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/40 transition-colors bg-background/50">
            <div className="min-w-0 flex-1">
              <Link to={`/thread/${t.id}`} className="font-bold text-sm hover:text-primary truncate block">{t.title}</Link>
              <div className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">
                {t.categories?.name} • {format(new Date(t.created_at), 'PPP')}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)} className="text-muted-foreground hover:text-destructive shrink-0 ml-4">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
})

const SavedPostsSection = memo(function SavedPostsSection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['bookmarks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('bookmarks').select('id, threads(id, title)').eq('user_id', user!.id)
      return data || []
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => supabase.from('bookmarks').delete().eq('id', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  })

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-lg font-bold mb-4">Bookmarked Threads</h2>
      {q.data?.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-3xl border-border">
          <p className="text-sm text-muted-foreground">No bookmarks saved yet.</p>
        </div>
      ) : (
        q.data?.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/50">
            <Link to={`/thread/${b.threads?.id}`} className="font-bold text-sm hover:text-primary flex-1 truncate">{b.threads?.title || 'Untitled Thread'}</Link>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(b.id)} className="shrink-0 ml-4">Remove</Button>
          </div>
        ))
      )}
    </div>
  )
})

const SettingsSection = memo(function SettingsSection({ profile, onSaved }: { profile: any, onSaved: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    username: profile.username || '',
    bio: profile.bio || '',
    lga: profile.lga || '',
  })
  const [uploading, setUploading] = useState(false)

  // Use a ref-like comparison to avoid re-triggering if profile is effectively same
  useEffect(() => {
    const isDifferent =
      profile.display_name !== form.display_name ||
      profile.username !== form.username ||
      profile.bio !== form.bio ||
      profile.lga !== form.lga;

    if (isDifferent) {
       setForm({
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        lga: profile.lga || '',
      })
    }
  }, [profile.id, profile.updated_at]) // Use specific ID and timestamp to track changes

  const save = async () => {
    if (!user) return
    const { error } = await saveProfile(user.id, form)
    if (error) return toast.error(error.message)
    toast.success('Profile updated!')
    onSaved()
  }

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploading(true)
    try {
      const webp = await toWebP(file)
      const path = `${user.id}/${Date.now()}.webp`
      const { uploadAndScan } = await import('@/lib/scanAttachment')
      const res = await uploadAndScan('avatars', path, webp, { contentType: 'image/webp', upsert: true })
      if (!res.uploaded) throw new Error(res.error)
      await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id)
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Avatar upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-6 pb-6 border-b">
        <UserAvatar avatarUrl={profile.avatar_url} displayName={form.display_name} size="xl" className="h-20 w-20 ring-4 ring-muted shadow-lg" />
        <label className="cursor-pointer">
          <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          <Button asChild variant="secondary" size="sm" className="rounded-xl" disabled={uploading}>
            <span>{uploading ? 'Working...' : 'Change Photo'}</span>
          </Button>
        </label>
      </div>

      <div className="grid gap-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-muted-foreground">Display Name</Label>
            <Input value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} className="rounded-xl h-12 bg-background border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-muted-foreground">Username</Label>
            <Input value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="rounded-xl h-12 bg-background border-border" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-black uppercase text-muted-foreground">About Me / Bio</Label>
          <BioField value={form.bio} onChange={v => setForm({...form, bio: v})} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-black uppercase text-muted-foreground">LGA of Origin</Label>
          <Input value={form.lga} onChange={e => setForm({...form, lga: e.target.value})} className="rounded-xl h-12 bg-background border-border" />
        </div>
        <Button onClick={save} className="h-12 rounded-xl text-md font-bold mt-4 shadow-lg shadow-primary/20">Save Profile Changes</Button>
      </div>

      <div className="pt-8 border-t border-border space-y-6">
        <NotificationSoundToggle />
        <NativeAppDownload />
      </div>
    </div>
  )
})

function LinkCard({ to, title, desc, icon: Icon }: { to: string, title: string, desc: string, icon: any }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-4 animate-in zoom-in-95 duration-300">
      <div className="p-5 rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
        <Icon className="size-12" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{desc}</p>
      </div>
      <Button asChild variant="outline" className="rounded-full px-10 h-12 font-bold hover:bg-primary hover:text-white transition-all">
        <Link to={to} className="flex items-center">Open Page <ChevronRight className="size-4 ml-2" /></Link>
      </Button>
    </div>
  )
}
