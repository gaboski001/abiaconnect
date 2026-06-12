import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Search, MessageSquare, Lock } from 'lucide-react'
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
        .select('*')
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
          { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true },
        )
        .select('subgroup_id')
      if (error) throw error
      const action = data && data.length > 0 ? 'joined' : 'duplicate_ignored'
      await supabase
        .from('subgroup_membership_audit')
        .insert({ subgroup_id: subgroupId, user_id: user.id, action })
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
      await supabase
        .from('subgroup_membership_audit')
        .insert({ subgroup_id: subgroupId, user_id: user.id, action: 'left' })
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
    return list.filter((s) => s.name.toLowerCase().includes(q))
  }, [groupsQ.data, search])

  return (
    <div className="container mx-auto px-4 py-8">
      <SEO title="Community Subgroups" description="Discover and join subgroups of like-minded Abians on AbiaConnect." path="/subgroups" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary/10 p-2 text-secondary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Community Subgroups</h1>
            <p className="text-sm text-muted-foreground">
              Discover and join groups of like-minded Abians
            </p>
          </div>
        </div>
        {user && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Create Subgroup
              </Button>
            </DialogTrigger>
            <CreateSubgroupDialog
              onClose={() => setOpen(false)}
              onCreated={() => qc.invalidateQueries({ queryKey: ['subgroups'] })}
            />
          </Dialog>
        )}
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subgroups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {groupsQ.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No subgroups found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const joined = myMembershipsQ.data?.has(s.id) ?? false
            return (
              <div
                key={s.id}
                className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
              >
                <Link to={`/subgroups/${s.id}`} className="block">
                  <div
                    className={`h-28 bg-gradient-to-br ${gradientFor(s.name)} relative`}
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
                    {s.is_private && (
                      <Badge className="absolute top-2 right-2 bg-black/60 border-secondary/40 text-secondary">
                        <Lock className="h-3 w-3 mr-1" /> Private
                      </Badge>
                    )}
                  </div>
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/subgroups/${s.id}`}>
                      <h3 className="font-bold text-lg hover:text-secondary transition-colors">
                        {s.name}
                      </h3>
                    </Link>
                    {s.category && (
                      <Badge variant="outline" className="shrink-0">
                        {s.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {s.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {s.member_count} members
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> {s.thread_count} threads
                    </span>
                  </div>
                  <div className="mt-4">
                    {!user ? (
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to="/login">Sign in to join</Link>
                      </Button>
                    ) : joined ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={leaveMut.isPending}
                        onClick={() => leaveMut.mutate(s.id)}
                      >
                        Leave
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={joinMut.isPending}
                        onClick={() => joinMut.mutate(s.id)}
                      >
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
      // auto-join as a member
      if (data?.id) {
        await supabase
          .from('subgroup_members')
          .upsert({ subgroup_id: data.id, user_id: user.id }, { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true })
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
    <DialogContent>
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
        <div className="flex items-center justify-between rounded-lg border p-3">
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
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Creating...' : 'Create Subgroup'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
