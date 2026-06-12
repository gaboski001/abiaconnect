import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Users, MessageSquare, ArrowLeft, Plus, Lock, Pin, PinOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { SUBGROUP_MEMBERS_UPSERT_OPTIONS } from '@/lib/subgroupMembers'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/ui/UserAvatar'

const PAGE_SIZE = 15
const MEMBERS_PAGE_SIZE = 20

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

export default function SubgroupDetail() {
  const { subgroupId } = useParams<{ subgroupId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)

  const groupQ = useQuery({
    queryKey: ['subgroup', subgroupId],
    enabled: !!subgroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroups')
        .select('id, name, description, category, cover_image_url, is_private, is_active, created_by, created_at')
        .eq('id', subgroupId!)
        .single()
      if (error) throw error
      return data as any
    },
    staleTime: 60_000,
  })

  const memberCountQ = useQuery({
    queryKey: ['subgroup-member-count', subgroupId],
    enabled: !!subgroupId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('subgroup_members')
        .select('subgroup_id', { count: 'exact', head: true })
        .eq('subgroup_id', subgroupId!)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 30_000,
  })

  const membershipQ = useQuery({
    queryKey: ['subgroup-membership', subgroupId, user?.id],
    enabled: !!subgroupId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroup_members')
        .select('user_id')
        .eq('subgroup_id', subgroupId!)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
    staleTime: Infinity,
  })

  const threadsQ = useQuery({
    queryKey: ['subgroup-threads', subgroupId, page],
    enabled: !!subgroupId,
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('threads')
        .select('id, subgroup_id, author_id, title, tags, is_anonymous, created_at, is_pinned, pinned_at, upvotes, view_count, profiles:author_id(display_name, avatar_url)')
        .eq('subgroup_id', subgroupId!)
        .order('is_pinned', { ascending: false })
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return (data ?? []) as any[]
    },
    placeholderData: (prev) => prev,
  })

  const isMember = membershipQ.data === true
  const memberCount = memberCountQ.data ?? 0
  const isSubgroupAdmin = !!user && !!groupQ.data && groupQ.data.created_by === user.id

  const pinMut = useMutation({
    mutationFn: async ({ threadId, pinned }: { threadId: string; pinned: boolean }) => {
      const { error } = await supabase.rpc('pin_subgroup_thread', {
        _thread_id: threadId,
        _pinned: pinned,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subgroup-threads', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update pin'),
  })

  const [membersPage, setMembersPage] = useState(0)
  const membersDirectoryQ = useQuery({
    queryKey: ['subgroup-member-directory', subgroupId, membersPage],
    enabled: !!subgroupId,
    queryFn: async () => {
      const from = membersPage * MEMBERS_PAGE_SIZE
      const to = from + MEMBERS_PAGE_SIZE - 1
      const { data: rows, error } = await supabase
        .from('subgroup_members')
        .select('user_id, created_at')
        .eq('subgroup_id', subgroupId!)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      const list = (rows ?? []) as Array<{ user_id: string; created_at: string }>
      if (!list.length) return [] as any[]
      const ids = list.map((r) => r.user_id)
      const [{ data: profs }, { data: threadsByUser }] = await Promise.all([
        supabase.rpc('get_public_profiles', { _ids: ids }),
        supabase
          .from('threads')
          .select('author_id')
          .eq('subgroup_id', subgroupId!)
          .in('author_id', ids),
      ])
      const profMap = new Map<string, any>()
      ;(profs ?? []).forEach((p: any) => profMap.set(p.id, p))
      const threadCounts: Record<string, number> = {}
      ;(threadsByUser ?? []).forEach((r: any) => {
        if (!r.author_id) return
        threadCounts[r.author_id] = (threadCounts[r.author_id] || 0) + 1
      })
      return list.map((r) => ({
        user_id: r.user_id,
        joined_at: r.created_at,
        display_name: profMap.get(r.user_id)?.display_name ?? 'Member',
        avatar_url: profMap.get(r.user_id)?.avatar_url ?? null,
        thread_count: threadCounts[r.user_id] || 0,
      }))
    },
    placeholderData: (prev) => prev,
  })

  const joinMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required')
      const { data, error } = await supabase
        .from('subgroup_members')
        .upsert(
          { subgroup_id: subgroupId!, user_id: user.id },
          SUBGROUP_MEMBERS_UPSERT_OPTIONS,
        )
        .select('subgroup_id')
      if (error) throw error
      const action = data && data.length > 0 ? 'joined' : 'duplicate_ignored'
      return action
    },
    onSuccess: (action) => {
      toast.success(action === 'joined' ? 'Joined subgroup' : 'Already a member')
      qc.invalidateQueries({ queryKey: ['subgroup-membership', subgroupId] })
      qc.invalidateQueries({ queryKey: ['subgroup-member-count', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to join'),
  })

  const leaveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required')
      const { error } = await supabase
        .from('subgroup_members')
        .delete()
        .eq('subgroup_id', subgroupId!)
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Left subgroup')
      qc.invalidateQueries({ queryKey: ['subgroup-membership', subgroupId] })
      qc.invalidateQueries({ queryKey: ['subgroup-member-count', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to leave'),
  })

  if (groupQ.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (!groupQ.data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Subgroup not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/subgroups">Back to subgroups</Link>
        </Button>
      </div>
    )
  }

  const s = groupQ.data

  return (
    <div className="container mx-auto px-4 py-6">
      <SEO
        title={s?.name ? `${s.name} | AbiaConnect` : 'Subgroup'}
        description={s?.description || 'Join this subgroup on AbiaConnect.'}
        path={`/subgroups/${subgroupId ?? ''}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: s?.name || 'Subgroup',
            description: s?.description || 'Join this subgroup on AbiaConnect.',
            url: `https://abiaconnect.com/subgroups/${subgroupId}`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://abiaconnect.com/' },
              { '@type': 'ListItem', position: 2, name: 'Subgroups', item: 'https://abiaconnect.com/subgroups' },
              { '@type': 'ListItem', position: 3, name: s?.name || 'Subgroup', item: `https://abiaconnect.com/subgroups/${subgroupId}` },
            ],
          },
        ]}
      />
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/subgroups">
          <ArrowLeft className="h-4 w-4 mr-1" /> All subgroups
        </Link>
      </Button>

      <div
        className={`rounded-2xl overflow-hidden border bg-gradient-to-br ${gradientFor(s.name)} relative`}
        style={
          s.cover_image_url
            ? {
                backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.2)), url(${s.cover_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="p-6 md:p-8 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">{s.name}</h1>
                {s.is_private && (
                  <Badge className="bg-black/40 border-secondary/40 text-secondary">
                    <Lock className="h-3 w-3 mr-1" /> Private
                  </Badge>
                )}
                {s.category && (
                  <Badge variant="outline" className="border-white/30 text-white">
                    {s.category}
                  </Badge>
                )}
              </div>
              <p className="text-white/80 max-w-2xl">
                {s.description || 'No description provided.'}
              </p>
              <div className="flex items-center gap-4 text-sm text-white/80">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" /> {memberCount} members
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> {threadsQ.data?.length ?? 0} threads
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!user ? (
                <Button asChild variant="secondary">
                  <Link to="/login">Sign in to join</Link>
                </Button>
              ) : isMember ? (
                <>
                  <Button asChild>
                    <Link to={`/create-thread?subgroup=${s.id}`}>
                      <Plus className="h-4 w-4 mr-1" /> Post in this group
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => leaveMut.mutate()}
                    disabled={leaveMut.isPending}
                    className="bg-transparent border-white/40 text-white hover:bg-white/10"
                  >
                    Leave
                  </Button>
                </>
              ) : (
                <Button onClick={() => joinMut.mutate()} disabled={joinMut.isPending}>
                  Join
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="threads" className="mt-6">
        <TabsList>
          <TabsTrigger value="threads">Threads</TabsTrigger>
          <TabsTrigger value="members">
            Members
            <Badge variant="secondary" className="ml-2">{memberCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="mt-4">
          {threadsQ.isLoading && page === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (threadsQ.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed">
              No threads yet in this subgroup.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {threadsQ.data!.map((t: any) => (
                  <div
                    key={t.id}
                    className="rounded-xl border bg-card p-4 hover:border-secondary/40 transition-colors flex items-start justify-between gap-3"
                  >
                    <Link to={`/thread/${t.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {t.is_pinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" /> Pinned
                          </Badge>
                        )}
                        <h3 className="font-semibold truncate">{t.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        by {t.is_anonymous ? 'Anonymous' : (t.profiles?.display_name || 'Member')} ·{' '}
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </p>
                    </Link>
                    {isSubgroupAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pinMut.isPending}
                        onClick={(e) => {
                          e.preventDefault()
                          pinMut.mutate({ threadId: t.id, pinned: !t.is_pinned })
                        }}
                        title={t.is_pinned ? 'Unpin' : 'Pin to top'}
                      >
                        {t.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-center mt-4 gap-2">
                {page > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    Previous
                  </Button>
                )}
                {(threadsQ.data?.length ?? 0) === PAGE_SIZE && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={threadsQ.isFetching}
                  >
                    {threadsQ.isFetching ? 'Loading…' : 'Load more'}
                  </Button>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          {membersDirectoryQ.isLoading && membersPage === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (membersDirectoryQ.data ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed">
              No members yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {membersDirectoryQ.data!.map((m: any) => (
                  <div
                    key={m.user_id}
                    className="rounded-xl border bg-card p-3 flex items-center gap-3"
                  >
                    <UserAvatar
                      avatarUrl={m.avatar_url}
                      displayName={m.display_name}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {format(new Date(m.joined_at), 'MMM d, yyyy')} ·{' '}
                        {m.thread_count} thread{m.thread_count === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center mt-4 gap-2">
                {membersPage > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setMembersPage((p) => Math.max(0, p - 1))}>
                    Previous
                  </Button>
                )}
                {(membersDirectoryQ.data?.length ?? 0) === MEMBERS_PAGE_SIZE && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMembersPage((p) => p + 1)}
                    disabled={membersDirectoryQ.isFetching}
                  >
                    {membersDirectoryQ.isFetching ? 'Loading…' : 'Load more'}
                  </Button>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
