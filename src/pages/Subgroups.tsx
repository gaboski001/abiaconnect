import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, MessageSquare, Plus, Search, Users } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { SUBGROUP_MEMBERS_UPSERT_OPTIONS } from '@/lib/subgroupMembers'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

interface Subgroup {
  id: string
  name: string
  description?: string | null
  category?: string | null
  cover_image_url?: string | null
  is_private?: boolean | null
  is_active?: boolean | null
  member_count?: number
  thread_count?: number
}

const gradientFor = (name: string) => {
  const palettes = [
    'from-emerald-700 via-emerald-900 to-black',
    'from-amber-700 via-amber-900 to-black',
    'from-rose-700 via-rose-900 to-black',
    'from-sky-700 via-sky-900 to-black',
    'from-violet-700 via-violet-900 to-black',
    'from-teal-700 via-teal-900 to-black',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palettes[h % palettes.length]
}

export default function Subgroups() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const groupsQ = useQuery({
    queryKey: ['subgroups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroups')
        .select('id, name, description, category, cover_image_url, is_private, is_active')
        .eq('is_active', true)
      if (error) throw error
      const list = (data ?? []) as Subgroup[]
      if (!list.length) return [] as Subgroup[]
      const ids = list.map((s) => s.id)
      const [{ data: members }, { data: threads }] = await Promise.all([
        supabase.from('subgroup_members').select('subgroup_id').in('subgroup_id', ids),
        supabase.from('threads').select('subgroup_id').in('subgroup_id', ids),
      ])
      const memberCount: Record<string, number> = {}
      const threadCount: Record<string, number> = {}
      ;(members ?? []).forEach((r: any) => {
        memberCount[r.subgroup_id] = (memberCount[r.subgroup_id] || 0) + 1
      })
      ;(threads ?? []).forEach((r: any) => {
        threadCount[r.subgroup_id] = (threadCount[r.subgroup_id] || 0) + 1
      })
      return list
        .map((s) => ({
          ...s,
          member_count: memberCount[s.id] || 0,
          thread_count: threadCount[s.id] || 0,
        }))
        .sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
    },
    staleTime: 60_000,
  })

  const myMembershipsQ = useQuery({
    queryKey: ['my-subgroups', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroup_members')
        .select('subgroup_id')
        .eq('user_id', user!.id)
      if (error) throw error
      return new Set((data ?? []).map((r: any) => r.subgroup_id as string))
    },
  })

  const joinMut = useMutation({
    mutationFn: async (subgroupId: string) => {
      if (!user) throw new Error('Sign in required')
      const { data, error } = await supabase
        .from('subgroup_members')
        .upsert(
          { subgroup_id: subgroupId, user_id: user.id },
          SUBGROUP_MEMBERS_UPSERT_OPTIONS,
        )
        .select('subgroup_id')
      if (error) throw error
      const action = data && data.length > 0 ? 'joined' : 'duplicate_ignored'
      return action
    },
    onSuccess: (action) => {
      toast.success(action === 'joined' ? 'Joined subgroup' : 'Already a member')
      qc.invalidateQueries({ queryKey: ['my-subgroups'] })
      qc.invalidateQueries({ queryKey: ['subgroups'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to join'),
  })

  const leaveMut = useMutation({
    mutationFn: async (subgroupId: string) => {
      if (!user) throw new Error('Sign in required')
      const { error } = await supabase
        .from('subgroup_members')
        .delete()
        .eq('subgroup_id', subgroupId)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Left subgroup')
      qc.invalidateQueries({ queryKey: ['my-subgroups'] })
      qc.invalidateQueries({ queryKey: ['subgroups'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to leave'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = groupsQ.data ?? []
    if (!q) return list
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    )
  }, [groupsQ.data, search])

  const totalMembers = (groupsQ.data ?? []).reduce((sum, item) => sum + (item.member_count ?? 0), 0)
  const totalThreads = (groupsQ.data ?? []).reduce((sum, item) => sum + (item.thread_count ?? 0), 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <SEO title="Community Subgroups" description="Discover and join subgroups of like-minded Abians on AbiaConnect." path="/subgroups" />

      <section
        className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/96 p-5 text-slate-950 sm:p-6 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
        style={{ boxShadow: PREMIUM_SHADOW }}
      >
        <div className="absolute inset-0 opacity-80 dark:opacity-100" style={{ background: 'radial-gradient(circle at top right, rgba(248,195,1,0.18), transparent 32%), radial-gradient(circle at bottom left, rgba(28,169,217,0.16), transparent 36%)' }} />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.06]">
                <Users className="h-6 w-6" style={{ color: MOBILE_BRAND.gold }} />
              </div>
              <div>
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/80"
                  style={{ background: GOLD_GRADIENT_SOFT }}
                >
                  Community circles
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Community Subgroups</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-700 dark:text-slate-300/76">
                  Discover professional, well-organized subgroup spaces for focused conversations, local interests, collaboration, and cultural exchange.
                </p>
              </div>
            </div>
            {user && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12 rounded-2xl border-0 px-5 font-bold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
                    <Plus className="mr-2 h-4 w-4" /> Create Subgroup
                  </Button>
                </DialogTrigger>
                <CreateSubgroupDialog
                  onClose={() => setOpen(false)}
                  onCreated={() => qc.invalidateQueries({ queryKey: ['subgroups'] })}
                />
              </Dialog>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoMetric label="Visible groups" value={String(filtered.length || groupsQ.data?.length || 0)} />
            <InfoMetric label="Active members" value={String(totalMembers)} compact />
            <InfoMetric label="Thread hubs" value={String(totalThreads)} compact />
          </div>
        </div>
      </section>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
        <Input
          placeholder="Search subgroups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 rounded-2xl border-slate-200/80 bg-white/96 pl-9 text-slate-950 placeholder:text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-400"
        />
      </div>

      {groupsQ.isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-[1.8rem] bg-slate-100 dark:bg-white/[0.05]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-[1.8rem] border border-dashed border-slate-200/80 bg-white/90 px-5 py-16 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300/70">
          No subgroups found.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const joined = myMembershipsQ.data?.has(s.id) ?? false
            return (
              <article
                key={s.id}
                className="flex flex-col overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/96 text-slate-950 transition duration-300 hover:-translate-y-1 hover:border-slate-300 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
                style={{ boxShadow: PREMIUM_SHADOW }}
              >
                <Link to={`/subgroups/${s.id}`} className="block">
                  <div
                    className={`relative h-32 bg-gradient-to-br ${gradientFor(s.name)}`}
                    style={
                      s.cover_image_url
                        ? {
                            backgroundImage: `url(${s.cover_image_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : undefined
                    }
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,22,0.18),rgba(5,12,22,0.68))]" />
                    {s.is_private && (
                      <Badge className="absolute right-3 top-3 border-white/15 bg-black/60 text-white">
                        <Lock className="mr-1 h-3 w-3" /> Private
                      </Badge>
                    )}
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/subgroups/${s.id}`}>
                      <h3 className="text-lg font-black tracking-tight text-slate-950 transition-colors hover:opacity-90 dark:text-white">
                        {s.name}
                      </h3>
                    </Link>
                    {s.category && (
                      <Badge variant="outline" className="shrink-0 border-slate-200/80 text-slate-700 dark:border-white/10 dark:text-slate-200">
                        {s.category}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-300/76">
                    {s.description || 'No description provided.'}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <StatChip icon={Users} label="Members" value={String(s.member_count ?? 0)} />
                    <StatChip icon={MessageSquare} label="Threads" value={String(s.thread_count ?? 0)} />
                  </div>
                  <div className="mt-5">
                    {!user ? (
                      <Button asChild variant="outline" size="sm" className="h-11 w-full rounded-2xl border-slate-200/80 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/[0.06]">
                        <Link to="/login">Sign in to join</Link>
                      </Button>
                    ) : joined ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 w-full rounded-2xl border-slate-200/80 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/[0.06]"
                        disabled={leaveMut.isPending}
                        onClick={() => leaveMut.mutate(s.id)}
                      >
                        Leave subgroup
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-11 w-full rounded-2xl border-0 font-bold text-slate-950"
                        style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                        disabled={joinMut.isPending}
                        onClick={() => joinMut.mutate(s.id)}
                      >
                        Join subgroup
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InfoMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/92 p-3.5 dark:border-white/10 dark:bg-white/[0.05]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300/62">{label}</p>
      <p className={`mt-2 font-black text-slate-950 dark:text-white ${compact ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>{value}</p>
    </div>
  )
}

function StatChip({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" style={{ color: MOBILE_BRAND.gold }} />
        {label}
      </div>
      <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

function CreateSubgroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [cover, setCover] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!user) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('subgroups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
          cover_image_url: cover.trim() || null,
          is_private: isPrivate,
          is_active: true,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (error) throw error
      if (data?.id) {
        await supabase
          .from('subgroup_members')
          .upsert({ subgroup_id: data.id, user_id: user.id }, SUBGROUP_MEMBERS_UPSERT_OPTIONS)
      }
      toast.success('Subgroup created')
      onCreated()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create subgroup')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="rounded-[1.8rem] border-slate-200/80 bg-white/98 dark:border-white/10 dark:bg-[rgba(8,14,26,0.98)]">
      <DialogHeader>
        <DialogTitle>Create a Subgroup</DialogTitle>
        <DialogDescription>
          Build a smaller community around a shared interest.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {['General', 'Politics', 'Business', 'Education', 'Culture', 'Sports', 'Tech'].map(
                (c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cover Image URL (optional)</Label>
          <Input
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
          <div>
            <Label>Private group</Label>
            <p className="text-xs text-muted-foreground">
              New members will require approval to join
            </p>
          </div>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving} className="border-0 text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
          {saving ? 'Creating...' : 'Create Subgroup'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
