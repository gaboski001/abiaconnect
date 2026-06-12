import { Link, useParams } from 'react-router-dom'
import { SEO } from '@/components/SEO'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Users, MessageSquare, ArrowLeft, Plus, Lock, Pin } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

  const groupQ = useQuery({
    queryKey: ['subgroup', subgroupId],
    enabled: !!subgroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroups')
        .select('*')
        .eq('id', subgroupId!)
        .single()
      if (error) throw error
      return data as any
    },
  })

  const membersQ = useQuery({
    queryKey: ['subgroup-members', subgroupId],
    enabled: !!subgroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subgroup_members')
        .select('user_id')
        .eq('subgroup_id', subgroupId!)
      if (error) throw error
      return (data ?? []) as Array<{ user_id: string }>
    },
  })

  const threadsQ = useQuery({
    queryKey: ['subgroup-threads', subgroupId],
    enabled: !!subgroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('id, category_id, subgroup_id, user_id, title, content, tags, allow_replies, is_anonymous, is_deleted, created_at, updated_at, is_pinned, upvotes, view_count, profiles:user_id(display_name, avatar_url)')
        .eq('subgroup_id', subgroupId!)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const isMember = !!user && !!membersQ.data?.find((m) => m.user_id === user.id)
  const memberCount = membersQ.data?.length ?? 0

  const joinMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sign in required')
      const { error } = await supabase
        .from('subgroup_members')
        .upsert({ subgroup_id: subgroupId!, user_id: user.id }, { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Joined subgroup')
      qc.invalidateQueries({ queryKey: ['subgroup-members', subgroupId] })
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
      qc.invalidateQueries({ queryKey: ['subgroup-members', subgroupId] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to leave'),
  })

  if (groupQ.isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-48 rounded-2xl bg-muted/40 animate-pulse" />
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

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-3">Threads</h2>
        {threadsQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (threadsQ.data ?? []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-xl border border-dashed">
            No threads yet in this subgroup.
          </div>
        ) : (
          <div className="space-y-2">
            {threadsQ.data!.map((t: any) => (
              <Link
                key={t.id}
                to={`/thread/${t.id}`}
                className="block rounded-xl border bg-card p-4 hover:border-secondary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {t.is_pinned && <Pin className="h-4 w-4 text-secondary" />}
                      <h3 className="font-semibold truncate">{t.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      by {t.profiles?.display_name || 'Anonymous'} ·{' '}
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
