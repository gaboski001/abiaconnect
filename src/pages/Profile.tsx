import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Award, Briefcase, Heart, MapPin, Navigation, Pencil, User as UserIcon } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { saveProfile, SEX_OPTIONS, MARITAL_STATUS_OPTIONS } from '@/lib/profileUpdate'
import { BioField } from '@/components/profile/BioField'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'

const SEX_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
}
const MARITAL_LABELS: Record<string, string> = {
  single: 'Single',
  married: 'Married',
  in_relationship: 'In a relationship',
  engaged: 'Engaged',
  divorced: 'Divorced',
  widowed: 'Widowed',
  separated: 'Separated',
  prefer_not_to_say: 'Prefer not to say',
}

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
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user!.id)
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <SEO title="Your Profile" description="View and edit your AbiaConnect profile, achievements, and recent posts." path="/profile" />
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <UserAvatar avatarUrl={profile.avatar_url} displayName={name} size="xl" className="h-24 w-24" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold">{name}</h1>
                {profile.username && (
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                )}
              </div>
              {!editing && (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="size-4" /> Edit Profile
                </Button>
              )}
            </div>

            {!editing ? (
              <>
                {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {profile.lga && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {profile.lga}
                    </span>
                  )}
                  {profile.created_at && (
                    <span>Joined {format(new Date(profile.created_at), 'PPP')}</span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Award className="size-3" /> {profile.reputation ?? 0} reputation
                  </span>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Display Name</Label>
                    <Input
                      value={form.display_name ?? ''}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Username</Label>
                    <Input
                      value={form.username ?? ''}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <BioField
                      value={form.bio ?? ''}
                      onChange={(v: string) => setForm({ ...form, bio: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>LGA</Label>
                    <Input
                      value={form.lga ?? ''}
                      onChange={(e) => setForm({ ...form, lga: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={save}>Save</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {achievementsQ.data && achievementsQ.data.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold mb-3">Achievements</h2>
          <div className="flex flex-wrap gap-2">
            {achievementsQ.data.map((a) => (
              <span
                key={a.id}
                title={a.description ?? ''}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 text-secondary-foreground px-3 py-1 text-sm font-medium"
              >
                {a.icon ?? '🏅'} {a.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-bold mb-3">My Recent Posts</h2>
        {threadsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !threadsQ.data?.length ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <ul className="space-y-2">
            {threadsQ.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <Link to={`/thread/${t.id}`} className="font-medium hover:text-primary truncate">
                  {t.title}
                </Link>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(t.created_at), 'PP')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
