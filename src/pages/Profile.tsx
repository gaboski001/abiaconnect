import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Award, ChevronRight, MapPin, Pencil, Sparkles, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveProfile } from '@/lib/profileUpdate'
import { BioField } from '@/components/profile/BioField'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { supabase } from '@/lib/supabase'
import { BLUE_GOLD_GRADIENT, GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

interface Profile {
  id?: string
  display_name?: string | null
  username?: string | null
  bio?: string | null
  lga?: string | null
  avatar_url?: string | null
  reputation?: number | null
  created_at?: string | null
}

interface Achievement {
  id: string
  name: string
  description?: string | null
  icon?: string | null
}

export default function Profile() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})

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

  const threadsQ = useQuery({
    queryKey: ['profile-threads', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('id, title, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; title: string; created_at: string }>
    },
  })

  const achievementsQ = useQuery({
    queryKey: ['achievements', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('achievements').select('*').eq('user_id', user!.id)
      if (error) return []
      return (data ?? []) as Achievement[]
    },
  })

  const profile = profileQ.data ?? {}
  const name = profile.display_name || user?.email?.split('@')[0] || 'You'

  const startEdit = () => {
    setForm({
      display_name: profile.display_name ?? '',
      username: profile.username ?? '',
      bio: profile.bio ?? '',
      lga: profile.lga ?? '',
    })
    setEditing(true)
  }

  const save = async () => {
    if (!user) return
    const { error } = await saveProfile(user.id, {
      display_name: form.display_name ?? undefined,
      username: form.username ?? undefined,
      bio: form.bio ?? undefined,
      lga: form.lga ?? undefined,
    })
    if (error) return toast.error(error.message)
    toast.success('Profile updated')
    setEditing(false)
    profileQ.refetch()
  }

  const stats = [
    { label: 'Reputation', value: String(profile.reputation ?? 0) },
    { label: 'Achievements', value: String(achievementsQ.data?.length ?? 0) },
    { label: 'Posts', value: String(threadsQ.data?.length ?? 0) },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SEO title="Your Profile" description="View and edit your AbiaConnect profile, achievements, and recent posts." path="/profile" />

      <section
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#091220] p-5 text-white sm:p-6"
        style={{ boxShadow: PREMIUM_SHADOW }}
      >
        <div className="absolute inset-0 opacity-95" style={{ background: 'linear-gradient(160deg, rgba(5,12,22,0.98) 10%, rgba(10,20,36,0.96) 55%, rgba(5,11,20,1) 100%)' }} />
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.20)' }} />
        <div className="absolute -left-8 bottom-0 h-36 w-36 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.18)' }} />

        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200/80" style={{ background: GOLD_GRADIENT_SOFT }}>
            <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
            Premium profile hub
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-[1.8rem] border border-white/10 bg-white/10 p-2.5 backdrop-blur-xl">
                <UserAvatar avatarUrl={profile.avatar_url} displayName={name} size="xl" className="h-24 w-24 border border-white/10" />
              </div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">{name}</h1>
                  {profile.username ? <p className="mt-1 text-sm text-slate-300/78">@{profile.username}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300/76">
                  {profile.lga ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                      <MapPin className="size-3.5" /> {profile.lga}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                    <Award className="size-3.5" /> {profile.reputation ?? 0} reputation
                  </span>
                  {profile.created_at ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                      Joined {format(new Date(profile.created_at), 'PPP')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {!editing ? (
              <Button
                type="button"
                onClick={startEdit}
                className="h-12 rounded-2xl px-5 font-bold text-slate-950"
                style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              >
                <Pencil className="mr-2 size-4" /> Edit profile
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/66">{stat.label}</p>
                <p className="mt-2 text-xl font-black sm:text-2xl">{stat.value}</p>
              </div>
            ))}
          </div>

          {!editing ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm leading-7 text-slate-200/82 backdrop-blur-xl">
              {profile.bio || 'Add a short bio to help other Abians know what you care about, where you represent, and how you contribute to the community.'}
            </div>
          ) : (
            <section className="rounded-[1.7rem] border border-white/10 bg-[rgba(8,14,26,0.88)] p-4 sm:p-5">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-900" style={{ background: BLUE_GOLD_GRADIENT }}>
                <UserRound className="size-3.5" /> Update identity
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-300/86">Display name</Label>
                  <Input value={form.display_name ?? ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/86">Username</Label>
                  <Input value={form.username ?? ''} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                </div>
                <div className="sm:col-span-2">
                  <BioField value={form.bio ?? ''} onChange={(v: string) => setForm({ ...form, bio: v })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300/86">LGA</Label>
                  <Input value={form.lga ?? ''} onChange={(e) => setForm({ ...form, lga: e.target.value })} className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={save} className="h-12 rounded-2xl px-5 font-bold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
                  Save changes
                </Button>
                <Button variant="ghost" className="h-12 rounded-2xl border border-white/10 text-slate-200 hover:bg-white/[0.05]" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </section>
          )}
        </div>
      </section>

      {achievementsQ.data && achievementsQ.data.length > 0 ? (
        <section className="rounded-[1.9rem] border border-white/10 bg-[rgba(8,14,26,0.9)] p-5 text-white" style={{ boxShadow: PREMIUM_SHADOW }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Achievements</h2>
              <p className="mt-1 text-sm text-slate-300/70">Milestones and badges collected across your journey.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {achievementsQ.data.map((a) => (
              <span key={a.id} title={a.description ?? ''} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold" style={{ background: GOLD_GRADIENT_SOFT }}>
                {a.icon ?? '🏅'} {a.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.9rem] border border-white/10 bg-[rgba(8,14,26,0.9)] p-5 text-white" style={{ boxShadow: PREMIUM_SHADOW }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Recent posts</h2>
            <p className="mt-1 text-sm text-slate-300/70">Quick access to your latest contributions and discussions.</p>
          </div>
        </div>

        {threadsQ.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        ) : !threadsQ.data?.length ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-slate-300/70">
            No posts yet. Start a conversation and your contributions will show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {threadsQ.data.map((t) => (
              <Link key={t.id} to={`/thread/${t.id}`} className="flex items-center gap-4 rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:bg-white/[0.06]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{t.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{format(new Date(t.created_at), 'PP')}</p>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
