import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { NEWCOMER_DAYS, daysSince, helloPath, loadTopics, loadWelcomeThread, useJourney } from '@/lib/journey'
import { SEO } from '@/components/SEO'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Users, MessageSquare, ArrowLeft, Plus, Lock, Pin, PinOff,
  ChevronDown, ChevronUp, ShieldCheck, Copy, Trash2, Check, X,
  ThumbsUp, Eye, Circle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { SUBGROUP_MEMBERS_UPSERT_OPTIONS } from '@/lib/subgroupMembers'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/UserAvatar'

const PAGE_SIZE = 15
const MEMBERS_PAGE_SIZE = 20
const sb = supabase as any

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
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTopic = searchParams.get('topic')
  const topicsQ = useQuery({
    queryKey: ['subgroup-topics', subgroupId],
    enabled: !!subgroupId,
    queryFn: () => loadTopics(subgroupId!),
    staleTime: 5 * 60_000,
  })
  const topics = topicsQ.data ?? []
  // Newcomers introduce themselves by replying on the group's welcome thread.
  const welcomeQ = useQuery({
    queryKey: ['subgroup-welcome-thread', subgroupId],
    enabled: !!subgroupId,
    queryFn: () => loadWelcomeThread(subgroupId!),
    staleTime: 5 * 60_000,
  })
  const welcomeThread = welcomeQ.data ?? null
  const journey = useJourney()
  const needsHello = !!journey.data && !journey.data.steps.hello && daysSince(journey.data.created_at) < NEWCOMER_DAYS
  const topicById = new Map(topics.map((t) => [t.id, t]))
  const currentTopic = activeTopic ? topicById.get(activeTopic) ?? null : null
  const chooseTopic = (id: string | null) => {
    setPage(0)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('topic', id)
    else next.delete('topic')
    setSearchParams(next, { replace: true })
  }
  const [rulesOpen, setRulesOpen] = useState(true)
  const [rulesDraft, setRulesDraft] = useState<string | null>(null)
  const [inviteExpiryHours, setInviteExpiryHours] = useState<number>(24)
  const [inviteSingleUse, setInviteSingleUse] = useState<boolean>(true)

  const groupQ = useQuery({
    queryKey: ['subgroup', subgroupId],
    enabled: !!subgroupId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('subgroups')
        .select('id, name, description, category, cover_image_url, is_private, is_active, created_by, created_at, rules')
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
    // Topics exist only once the newcomer database update is in; until then, ask without them.
    queryKey: ['subgroup-threads', subgroupId, page, activeTopic, topicsQ.data?.length ?? 0],
    enabled: !!subgroupId && topicsQ.isFetched,
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let query = sb
        .from('threads')
        .select(
          `id, subgroup_id, author_id, title, tags, is_anonymous, created_at, is_pinned, pinned_at, upvotes, view_count${
            topics.length ? ', topic_id' : ''
          }, profiles:author_id(display_name, avatar_url)`,
        )
        .eq('subgroup_id', subgroupId!)
      if (activeTopic && topics.length) query = query.eq('topic_id', activeTopic)
      const { data, error } = await query
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

  // 5e: Realtime presence — ephemeral active-member count
  const [activeCount, setActiveCount] = useState(0)
  useEffect(() => {
    // Only members may join the presence channel. Combined with the
    // Realtime Authorization policy on realtime.messages, non-members
    // cannot observe who is active in a private subgroup.
    if (!subgroupId || !user || !isMember) return
    const channel = supabase.channel(`subgroup-presence:${subgroupId}`, {
      config: { presence: { key: user.id }, private: true },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setActiveCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })
    return () => {
      channel.untrack().catch(() => {})
      supabase.removeChannel(channel)
      setActiveCount(0)
    }
  }, [subgroupId, user, isMember])

  // Realtime: prepend newly inserted threads for THIS subgroup only (scoped filter, page 0 only)
  useEffect(() => {
    if (!subgroupId || page !== 0) return
    const ch = supabase
      .channel(`subgroup-threads:${subgroupId}`)
      .on(
        'postgres_changes' as never,
        { event: 'INSERT', schema: 'public', table: 'threads', filter: `subgroup_id=eq.${subgroupId}` },
        (payload: any) => {
          const row = payload.new
          if (!row) return
          qc.setQueryData(['subgroup-threads', subgroupId, 0], (old: any[] | undefined) => {
            const list = old ?? []
            if (list.some((t) => t.id === row.id)) return list
            return [row, ...list].slice(0, PAGE_SIZE)
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [subgroupId, page, qc])

  // 5f: Reply counts for visible threads
  const threadIds = (threadsQ.data ?? []).map((t: any) => t.id)
  const replyCountsQ = useQuery({
    queryKey: ['thread-reply-counts', threadIds],
    enabled: threadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await sb.rpc('get_thread_reply_counts', { _thread_ids: threadIds })
      if (error) throw error
      const m: Record<string, number> = {}
      ;(data ?? []).forEach((r: any) => { m[r.thread_id] = Number(r.reply_count) })
      return m
    },
    staleTime: 30_000,
  })

  // 5f: View tracking — once per session per thread
  useEffect(() => {
    if (!threadIds.length) return
    const key = 'sg_viewed_threads'
    let seen: Record<string, number> = {}
    try { seen = JSON.parse(sessionStorage.getItem(key) || '{}') } catch {}
    const toLog = threadIds.filter((id) => !seen[id])
    if (!toLog.length) return
    // Debounce burst — fire all increments after 1.5s of stability
    const handle = window.setTimeout(() => {
      toLog.forEach((id) => {
        sb.rpc('increment_thread_view', { _thread_id: id }).then(() => {}, () => {})
        seen[id] = Date.now()
      })
      try { sessionStorage.setItem(key, JSON.stringify(seen)) } catch {}
    }, 1500)
    return () => window.clearTimeout(handle)
  }, [threadIds.join(',')])

  // My pending join request (for private subgroups)
  const myRequestQ = useQuery({
    queryKey: ['subgroup-my-request', subgroupId, user?.id],
    enabled: !!subgroupId && !!user && !!groupQ.data?.is_private && !isMember,
    queryFn: async () => {
      const { data, error } = await sb
        .from('subgroup_join_requests')
        .select('id, status, created_at')
        .eq('subgroup_id', subgroupId!)
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .maybeSingle()
      if (error) throw error
      return data as any
    },
  })

  // Admin: pending join requests
  const joinRequestsQ = useQuery({
    queryKey: ['subgroup-join-requests', subgroupId],
    enabled: !!subgroupId && isSubgroupAdmin,
    queryFn: async () => {
      const { data, error } = await sb
        .from('subgroup_join_requests')
        .select('id, user_id, status, message, created_at')
        .eq('subgroup_id', subgroupId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as any[]
      if (!rows.length) return [] as any[]
      const { data: profs } = await supabase.rpc('get_public_profiles', { _ids: rows.map((r) => r.user_id) })
      const m = new Map<string, any>()
      ;(profs ?? []).forEach((p: any) => m.set(p.id, p))
      return rows.map((r) => ({ ...r, profile: m.get(r.user_id) }))
    },
  })

  // Admin: invites
  const invitesQ = useQuery({
    queryKey: ['subgroup-invites', subgroupId],
    enabled: !!subgroupId && isSubgroupAdmin,
    queryFn: async () => {
      const { data, error } = await sb
        .from('subgroup_invites')
        .select('id, token, expires_at, used, single_use, created_at')
        .eq('subgroup_id', subgroupId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const pinMut = useMutation({
    mutationFn: async ({ threadId, pinned }: { threadId: string; pinned: boolean }) => {
      const { error } = await supabase.rpc('pin_subgroup_thread' as any, {
        _thread_id: threadId, _pinned: pinned,
      } as any)
      if (error) throw error
    },
    onMutate: async ({ threadId, pinned }) => {
      await qc.cancelQueries({ queryKey: ['subgroup-threads', subgroupId] })
      const prev = qc.getQueriesData({ queryKey: ['subgroup-threads', subgroupId] })
      qc.setQueriesData({ queryKey: ['subgroup-threads', subgroupId] }, (old: any) =>
        Array.isArray(old)
          ? old.map((t: any) => t.id === threadId ? { ...t, is_pinned: pinned, pinned_at: pinned ? new Date().toISOString() : null } : t)
          : old,
      )
      return { prev }
    },
    onError: (e: any, _v, ctx) => {
      ctx?.prev?.forEach(([k, v]: any) => qc.setQueryData(k, v))
      toast.error(e?.message || 'Failed to update pin')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['subgroup-threads', subgroupId] }),
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
        supabase.from('threads').select('author_id').eq('subgroup_id', subgroupId!).in('author_id', ids),
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
        .upsert({ subgroup_id: subgroupId!, user_id: user.id }, SUBGROUP_MEMBERS_UPSERT_OPTIONS)
        .select('subgroup_id')
      if (error) throw error
      return data && data.length > 0 ? 'joined' : 'duplicate_ignored'
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['subgroup-membership', subgroupId] })
      const prevMember = qc.getQueryData(['subgroup-membership', subgroupId, user?.id])
      const prevCount = qc.getQueryData(['subgroup-member-count', subgroupId])
      qc.setQueryData(['subgroup-membership', subgroupId, user?.id], true)
      qc.setQueryData(['subgroup-member-count', subgroupId], (c: any) => (typeof c === 'number' ? c + 1 : c))
      return { prevMember, prevCount }
    },
    onSuccess: (action) => {
      toast.success(action === 'joined' ? 'Joined subgroup' : 'Already a member')
    },
    onError: (e: any, _v, ctx) => {
      if (ctx) {
        qc.setQueryData(['subgroup-membership', subgroupId, user?.id], ctx.prevMember)
        qc.setQueryData(['subgroup-member-count', subgroupId], ctx.prevCount)
      }
      toast.error(e?.message || 'Failed to join')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['subgroup-membership', subgroupId] })
      qc.invalidateQueries({ queryKey: ['subgroup-member-count', subgroupId] })
    },
  })

  const leaveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required')
      const { error } = await supabase
        .from('subgroup_members').delete()
        .eq('subgroup_id', subgroupId!).eq('user_id', user.id)
      if (error) throw error
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['subgroup-membership', subgroupId] })
      const prevMember = qc.getQueryData(['subgroup-membership', subgroupId, user?.id])
      const prevCount = qc.getQueryData(['subgroup-member-count', subgroupId])
      qc.setQueryData(['subgroup-membership', subgroupId, user?.id], false)
      qc.setQueryData(['subgroup-member-count', subgroupId], (c: any) => (typeof c === 'number' ? Math.max(0, c - 1) : c))
      return { prevMember, prevCount }
    },
    onSuccess: () => toast.success('Left subgroup'),
    onError: (e: any, _v, ctx) => {
      if (ctx) {
        qc.setQueryData(['subgroup-membership', subgroupId, user?.id], ctx.prevMember)
        qc.setQueryData(['subgroup-member-count', subgroupId], ctx.prevCount)
      }
      toast.error(e?.message || 'Failed to leave')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['subgroup-membership', subgroupId] })
      qc.invalidateQueries({ queryKey: ['subgroup-member-count', subgroupId] })
    },
  })

  const requestJoinMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required')
      const { error } = await sb
        .from('subgroup_join_requests')
        .insert({ subgroup_id: subgroupId!, user_id: user.id, status: 'pending' })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Request sent. An admin will review it.')
      qc.invalidateQueries({ queryKey: ['subgroup-my-request', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to request'),
  })

  const decideMut = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await sb.rpc('decide_join_request', { _request_id: id, _approve: approve })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subgroup-join-requests', subgroupId] })
      qc.invalidateQueries({ queryKey: ['subgroup-member-count', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  })

  const saveRulesMut = useMutation({
    mutationFn: async (rules: string[]) => {
      const { error } = await sb.from('subgroups').update({ rules }).eq('id', subgroupId!)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Rules updated')
      setRulesDraft(null)
      qc.invalidateQueries({ queryKey: ['subgroup', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  })

  const createInviteMut = useMutation({
    mutationFn: async () => {
      const expires = inviteExpiryHours > 0
        ? new Date(Date.now() + inviteExpiryHours * 3600 * 1000).toISOString()
        : null
      const { error } = await sb.from('subgroup_invites').insert({
        subgroup_id: subgroupId!,
        created_by: user!.id,
        expires_at: expires,
        single_use: inviteSingleUse,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Invite created')
      qc.invalidateQueries({ queryKey: ['subgroup-invites', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create invite'),
  })

  const deleteInviteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('subgroup_invites').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subgroup-invites', subgroupId] }),
  })

  if (groupQ.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-20 rounded-xl" />))}
        </div>
      </div>
    )
  }
  if (!groupQ.data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Subgroup not found.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/subgroups">Back to subgroups</Link></Button>
      </div>
    )
  }

  const s = groupQ.data
  const rules: string[] = Array.isArray(s.rules) ? s.rules : []
  const hasPendingRequest = !!myRequestQ.data

  const renderJoinButton = () => {
    if (!user) {
      return <Button asChild variant="secondary"><Link to="/login">Sign in to join</Link></Button>
    }
    if (isMember) {
      return (
        <>
          <Button asChild>
            <Link to={`/create-thread?subgroup=${s.id}${activeTopic ? `&topic=${activeTopic}` : ''}`}>
              <Plus className="h-4 w-4 mr-1" /> Post in this group
            </Link>
          </Button>
          <Button variant="outline" onClick={() => leaveMut.mutate()} disabled={leaveMut.isPending}
            className="bg-transparent border-white/40 text-white hover:bg-white/10">Leave</Button>
        </>
      )
    }
    if (s.is_private) {
      return hasPendingRequest ? (
        <Button disabled variant="secondary">Request pending</Button>
      ) : (
        <Button onClick={() => requestJoinMut.mutate()} disabled={requestJoinMut.isPending}>
          Request to Join
        </Button>
      )
    }
    return <Button onClick={() => joinMut.mutate()} disabled={joinMut.isPending}>Join</Button>
  }

  const copyInvite = (token: string) => {
    const url = `${window.location.origin}/subgroups/invite/${token}`
    navigator.clipboard.writeText(url).then(
      () => toast.success('Invite link copied'),
      () => toast.error('Copy failed'),
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <SEO
        title={s?.name ? `${s.name} | AbiaConnect` : 'Subgroup'}
        description={s?.description || 'Join this subgroup on AbiaConnect.'}
        path={`/subgroups/${subgroupId ?? ''}`}
      />
      <Button asChild variant="ghost" size="sm" className="mb-4 native:hidden">
        <Link to="/subgroups"><ArrowLeft className="h-4 w-4 mr-1" /> All subgroups</Link>
      </Button>

      <div
        className={`rounded-2xl overflow-hidden border bg-gradient-to-br ${gradientFor(s.name)} relative`}
        style={s.cover_image_url ? {
          backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.2)), url(${s.cover_image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
        } : undefined}
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
                  <Badge variant="outline" className="border-white/30 text-white">{s.category}</Badge>
                )}
              </div>
              <p className="text-white/80 max-w-2xl">{s.description || 'No description provided.'}</p>
              <div className="flex items-center gap-4 text-sm text-white/80 flex-wrap">
                <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {memberCount} members</span>
                <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" /> {threadsQ.data?.length ?? 0} threads</span>
                {activeCount > 0 && (
                  <span className="flex items-center gap-1" title="Members active right now">
                    <Circle className="h-2.5 w-2.5 fill-emerald-400 text-emerald-400" />
                    {activeCount} active
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">{renderJoinButton()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-6">
        <div className="min-w-0">
          <Tabs defaultValue="threads">
            <TabsList>
              <TabsTrigger value="threads">Threads</TabsTrigger>
              <TabsTrigger value="members">
                Members <Badge variant="secondary" className="ml-2">{memberCount}</Badge>
              </TabsTrigger>
              {isSubgroupAdmin && (
                <TabsTrigger value="manage">
                  <ShieldCheck className="h-4 w-4 mr-1" /> Manage
                  {(joinRequestsQ.data?.length ?? 0) > 0 && (
                    <Badge variant="destructive" className="ml-2">{joinRequestsQ.data!.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="threads" className="mt-4">
              {welcomeThread && needsHello ? (
                <Link
                  to={helloPath(welcomeThread)}
                  className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-3 transition-colors hover:bg-primary/10"
                >
                  <span className="text-2xl" aria-hidden>👋🏾</span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">New here? Say hello!</span>{' '}
                    <span className="text-muted-foreground">Reply on the welcome post with your name, your town and what you do. Everyone will welcome you.</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-primary">Say hello</span>
                </Link>
              ) : null}
              {topics.length ? (
                <div className="mb-4 space-y-3">
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Topics in this group">
                    <TopicChip label="All topics" active={!activeTopic} onClick={() => chooseTopic(null)} />
                    {topics.map((t) => (
                      <TopicChip
                        key={t.id}
                        label={`${t.emoji ?? '💬'} ${t.name}`}
                        active={activeTopic === t.id}
                        onClick={() => chooseTopic(t.id)}
                      />
                    ))}
                  </div>
                  {currentTopic ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
                      <p className="text-sm">
                        <span className="font-semibold">{currentTopic.emoji} {currentTopic.name}.</span>{' '}
                        <span className="text-muted-foreground">{currentTopic.description}</span>
                      </p>
                      {isMember ? (
                        <Button asChild size="sm">
                          <Link to={currentTopic.name === 'Introduce yourself' && welcomeThread
                            ? helloPath(welcomeThread)
                            : `/create-thread?subgroup=${s.id}&topic=${currentTopic.id}`}>
                            <Plus className="h-4 w-4 mr-1" />
                            {currentTopic.name === 'Introduce yourself' ? 'Say hello' : 'Start a discussion here'}
                          </Link>
                        </Button>
                      ) : user && !s.is_private ? (
                        <Button size="sm" onClick={() => joinMut.mutate()} disabled={joinMut.isPending}>
                          Join to post here
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {threadsQ.isLoading && page === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-20 rounded-xl" />))}
                </div>
              ) : (threadsQ.data ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed">
                  {currentTopic ? `Nothing in “${currentTopic.name}” yet. Be the first!` : 'No discussions yet. Start the first one!'}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {threadsQ.data!.map((t: any) => (
                      <div key={t.id} className="rounded-xl border bg-card p-4 hover:border-secondary/40 transition-colors flex items-start justify-between gap-3">
                        <Link to={`/thread/${t.id}`} className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {t.is_pinned && (
                              <Badge variant="secondary" className="gap-1"><Pin className="h-3 w-3" /> Pinned</Badge>
                            )}
                            <h3 className="font-semibold truncate">{t.title}</h3>
                          </div>
                          {t.topic_id && topicById.get(t.topic_id) && !activeTopic ? (
                            <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {topicById.get(t.topic_id)!.emoji} {topicById.get(t.topic_id)!.name}
                            </span>
                          ) : null}
                          <p className="text-xs text-muted-foreground mt-1">
                            by {t.is_anonymous ? 'Anonymous' : (t.profiles?.display_name || 'Member')} ·{' '}
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {t.upvotes ?? 0}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {replyCountsQ.data?.[t.id] ?? 0}</span>
                            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {t.view_count ?? 0}</span>
                          </div>
                        </Link>
                        {isSubgroupAdmin && (
                          <Button variant="ghost" size="sm" disabled={pinMut.isPending}
                            onClick={(e) => { e.preventDefault(); pinMut.mutate({ threadId: t.id, pinned: !t.is_pinned }) }}
                            title={t.is_pinned ? 'Unpin' : 'Pin to top'}>
                            {t.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center mt-4 gap-2">
                    {page > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                    )}
                    {(threadsQ.data?.length ?? 0) === PAGE_SIZE && (
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={threadsQ.isFetching}>
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
                  {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-16 rounded-xl" />))}
                </div>
              ) : (membersDirectoryQ.data ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed">No members yet.</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {membersDirectoryQ.data!.map((m: any) => (
                      <div key={m.user_id} className="rounded-xl border bg-card p-3 flex items-center gap-3">
                        <UserAvatar avatarUrl={m.avatar_url} displayName={m.display_name} size="md" />
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
                      <Button variant="outline" size="sm" onClick={() => setMembersPage((p) => Math.max(0, p - 1))}>Previous</Button>
                    )}
                    {(membersDirectoryQ.data?.length ?? 0) === MEMBERS_PAGE_SIZE && (
                      <Button variant="outline" size="sm" onClick={() => setMembersPage((p) => p + 1)} disabled={membersDirectoryQ.isFetching}>
                        {membersDirectoryQ.isFetching ? 'Loading…' : 'Load more'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {isSubgroupAdmin && (
              <TabsContent value="manage" className="mt-4 space-y-6">
                {/* Rules editor */}
                <section className="rounded-xl border bg-card p-4">
                  <h3 className="font-semibold mb-2">Edit rules</h3>
                  <p className="text-xs text-muted-foreground mb-2">One rule per line.</p>
                  <Textarea
                    rows={6}
                    value={rulesDraft ?? rules.join('\n')}
                    onChange={(e) => setRulesDraft(e.target.value)}
                    placeholder="1. Be respectful&#10;2. No spam"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" disabled={saveRulesMut.isPending}
                      onClick={() => {
                        const lines = (rulesDraft ?? rules.join('\n'))
                          .split('\n').map((l) => l.trim()).filter(Boolean)
                        saveRulesMut.mutate(lines)
                      }}>
                      Save rules
                    </Button>
                    {rulesDraft !== null && (
                      <Button size="sm" variant="ghost" onClick={() => setRulesDraft(null)}>Cancel</Button>
                    )}
                  </div>
                </section>

                {/* Join requests */}
                {s.is_private && (
                  <section className="rounded-xl border bg-card p-4">
                    <h3 className="font-semibold mb-3">Join requests</h3>
                    {joinRequestsQ.isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : (joinRequestsQ.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No pending requests.</p>
                    ) : (
                      <div className="space-y-2">
                        {joinRequestsQ.data!.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-3 rounded-lg border p-2">
                            <UserAvatar
                              avatarUrl={r.profile?.avatar_url}
                              displayName={r.profile?.display_name || 'Member'}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{r.profile?.display_name || 'Member'}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Button size="sm" variant="outline"
                              onClick={() => decideMut.mutate({ id: r.id, approve: true })}
                              disabled={decideMut.isPending}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => decideMut.mutate({ id: r.id, approve: false })}
                              disabled={decideMut.isPending}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Invite links */}
                <section className="rounded-xl border bg-card p-4">
                  <h3 className="font-semibold mb-3">Invite links</h3>
                  <div className="flex flex-wrap items-end gap-2 mb-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Expires in (hours)</label>
                      <Input type="number" min={0} value={inviteExpiryHours}
                        onChange={(e) => setInviteExpiryHours(Number(e.target.value) || 0)}
                        className="w-32" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={inviteSingleUse}
                        onChange={(e) => setInviteSingleUse(e.target.checked)} />
                      Single-use
                    </label>
                    <Button size="sm" onClick={() => createInviteMut.mutate()} disabled={createInviteMut.isPending}>
                      Generate link
                    </Button>
                  </div>
                  {invitesQ.isLoading ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (invitesQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active invites.</p>
                  ) : (
                    <div className="space-y-2">
                      {invitesQ.data!.map((inv: any) => {
                        const expired = inv.expires_at && new Date(inv.expires_at) < new Date()
                        const dead = inv.used && inv.single_use
                        return (
                          <div key={inv.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                            <code className="truncate flex-1 text-xs">…/invite/{inv.token.slice(0, 12)}…</code>
                            {expired && <Badge variant="outline">Expired</Badge>}
                            {dead && <Badge variant="outline">Used</Badge>}
                            {!dead && !expired && inv.single_use && <Badge variant="secondary">Single-use</Badge>}
                            <Button size="sm" variant="ghost" onClick={() => copyInvite(inv.token)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteInviteMut.mutate(inv.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Rules sidebar */}
        <aside className="space-y-4">
          <Collapsible open={rulesOpen} onOpenChange={setRulesOpen} className="rounded-xl border bg-card">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 font-semibold">
              <span>Subgroup Rules</span>
              {rulesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rules set yet.</p>
              ) : (
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {rules.map((r, i) => (<li key={i}>{r}</li>))}
                </ol>
              )}
            </CollapsibleContent>
          </Collapsible>
        </aside>
      </div>
    </div>
  )
}

function TopicChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50'
      }`}
    >
      {label}
    </button>
  )
}
