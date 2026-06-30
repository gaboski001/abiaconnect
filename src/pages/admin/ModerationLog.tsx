import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, ShieldAlert, Check, X, MessageSquareWarning } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SEO } from '@/components/SEO'
import { useAuth } from '@/hooks/useAuth'

interface ModRow {
  id: string
  user_id: string | null
  surface: string
  allowed: boolean
  reason: string | null
  categories: string[]
  title: string | null
  content_excerpt: string | null
  degraded: boolean
  overridden: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

interface AppealRow {
  id: string
  user_id: string
  surface: string
  original_content: string
  original_title: string | null
  reason_shown: string | null
  categories: string[] | null
  user_note: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

type LogFilter = 'blocked' | 'overridden' | 'all'
type AppealFilter = 'pending' | 'approved' | 'rejected' | 'all'

function fmt(ts: string) {
  return new Date(ts).toLocaleString()
}

function LogSection({ isAdmin }: { isAdmin: boolean }) {
  const [filter, setFilter] = useState<LogFilter>('blocked')
  const qc = useQueryClient()

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['moderation-log', filter],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase
        .from('moderation_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (filter === 'blocked') q = q.eq('allowed', false).eq('overridden', false)
      else if (filter === 'overridden') q = q.eq('overridden', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ModRow[]
    },
  })

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[]
  const { data: profiles = [] } = useQuery({
    queryKey: ['moderation-log-profiles', userIds.sort().join(',')],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_profiles', { _ids: userIds })
      if (error) throw error
      return (data ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>
    },
  })
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const override = useMutation({
    mutationFn: async (row: ModRow) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('moderation_log')
        .update({
          overridden: true,
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_note: 'False positive — approved by admin',
        })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Marked as false positive')
      qc.invalidateQueries({ queryKey: ['moderation-log'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Tabs value={filter} onValueChange={(v) => setFilter(v as LogFilter)}>
      <TabsList>
        <TabsTrigger value="blocked">Blocked</TabsTrigger>
        <TabsTrigger value="overridden">Overridden</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>

      <TabsContent value={filter} className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No entries.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const author = r.user_id ? profileMap.get(r.user_id) : null
              return (
                <article key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.allowed ? (
                        <Badge variant="secondary" className="gap-1"><ShieldCheck className="size-3" /> Allowed</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><ShieldAlert className="size-3" /> Blocked</Badge>
                      )}
                      {r.overridden && <Badge className="bg-emerald-600 hover:bg-emerald-600">Overridden</Badge>}
                      {r.degraded && <Badge variant="outline">Degraded</Badge>}
                      {r.categories.map((c) => (
                        <Badge key={c} variant="outline">{c}</Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                  </div>

                  <div className="text-sm">
                    <div className="font-semibold">{r.title || '(no title)'}</div>
                    {r.content_excerpt && (
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap line-clamp-4">{r.content_excerpt}</p>
                    )}
                  </div>

                  {r.reason && (
                    <div className="rounded-md bg-muted/40 border border-border p-2 text-xs">
                      <span className="font-medium">AI reason:</span> {r.reason}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
                    <div>
                      Author:{' '}
                      {author ? (
                        <span className="font-medium text-foreground">@{author.username ?? author.display_name ?? r.user_id}</span>
                      ) : (
                        <span>Unknown</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.reviewed_at && (
                        <span>Reviewed {fmt(r.reviewed_at)}</span>
                      )}
                      {!r.allowed && !r.overridden && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={override.isPending}
                          onClick={() => override.mutate(r)}
                          className="gap-1"
                        >
                          <Check className="size-3" /> Mark false positive
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

const PAGE_SIZE = 20

function AppealsSection({ isAdmin }: { isAdmin: boolean }) {
  const [filter, setFilter] = useState<AppealFilter>('pending')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [page, setPage] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  // Reset page when filter/sort change
  const resetPage = () => setPage(0)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['moderation-appeals', filter, sort, page],
    enabled: isAdmin,
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let q = supabase
        .from('moderation_appeals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sort === 'oldest' })
        .range(from, to)
      if (filter !== 'all') q = q.eq('status', filter)
      const { data, error, count } = await q
      if (error) throw error
      return { rows: (data ?? []) as AppealRow[], count: count ?? 0 }
    },
  })
  const rows = data?.rows ?? []
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)))
  const { data: profiles = [] } = useQuery({
    queryKey: ['moderation-appeals-profiles', userIds.sort().join(',')],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_profiles', { _ids: userIds })
      if (error) throw error
      return (data ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>
    },
  })
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const decide = useMutation({
    mutationFn: async ({ row, status }: { row: AppealRow; status: 'approved' | 'rejected' }) => {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('moderation_appeals')
        .update({
          status,
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_note: notes[row.id]?.trim() || null,
        })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'approved' ? 'Appeal approved' : 'Appeal denied')
      setNotes((n) => {
        const { [vars.row.id]: _x, ...rest } = n
        return rest
      })
      qc.invalidateQueries({ queryKey: ['moderation-appeals'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Tabs value={filter} onValueChange={(v) => { setFilter(v as AppealFilter); resetPage() }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Denied</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-muted-foreground">Sort</label>
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
            value={sort}
            onChange={(e) => { setSort(e.target.value as 'newest' | 'oldest'); resetPage() }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <TabsContent value={filter} className="mt-4">

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            No appeals.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const author = profileMap.get(r.user_id)
              const pending = r.status === 'pending'
              return (
                <article key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{r.surface}</Badge>
                      {r.status === 'pending' && <Badge className="bg-amber-500 hover:bg-amber-500">Pending</Badge>}
                      {r.status === 'approved' && <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>}
                      {r.status === 'rejected' && <Badge variant="destructive">Denied</Badge>}
                      {(r.categories ?? []).map((c) => (
                        <Badge key={c} variant="outline">{c}</Badge>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    From:{' '}
                    {author ? (
                      <span className="font-medium text-foreground">@{author.username ?? author.display_name ?? r.user_id}</span>
                    ) : (
                      <span>Unknown</span>
                    )}
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 p-2 text-sm">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Original content</div>
                    {r.original_title && <div className="font-semibold">{r.original_title}</div>}
                    <p className="whitespace-pre-wrap">{r.original_content}</p>
                  </div>

                  {r.reason_shown && (
                    <div className="rounded-md bg-muted/40 border border-border p-2 text-xs">
                      <span className="font-medium">AI reason shown:</span> {r.reason_shown}
                    </div>
                  )}

                  <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
                    <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <MessageSquareWarning className="size-3" /> User's note
                    </div>
                    <p className="whitespace-pre-wrap">{r.user_note}</p>
                  </div>

                  {pending ? (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <Textarea
                        placeholder="Optional review note…"
                        value={notes[r.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ row: r, status: 'rejected' })}
                          className="gap-1"
                        >
                          <X className="size-3" /> Deny
                        </Button>
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ row: r, status: 'approved' })}
                          className="gap-1"
                        >
                          <Check className="size-3" /> Approve
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                      {r.reviewed_at && <div>Reviewed {fmt(r.reviewed_at)}</div>}
                      {r.review_note && (
                        <div><span className="font-medium">Admin note:</span> {r.review_note}</div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
            <div>
              {total === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)}`} of {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span>Page {page + 1} / {totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPages || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

export default function ModerationLog() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'log' | 'appeals'>('log')

  if (authLoading) {
    return <div className="container mx-auto max-w-5xl py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="container mx-auto max-w-5xl py-6 space-y-6">
      <SEO title="Moderation Log" description="Admin review of AI-moderated submissions and user appeals." path="/admin/moderation" />
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" /> Moderation
        </h1>
        <p className="text-sm text-muted-foreground">Review AI-flagged submissions and user appeals.</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'log' | 'appeals')}>
        <TabsList>
          <TabsTrigger value="log">Log</TabsTrigger>
          <TabsTrigger value="appeals">Appeals</TabsTrigger>
        </TabsList>
        <TabsContent value="log" className="mt-4">
          <LogSection isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="appeals" className="mt-4">
          <AppealsSection isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
