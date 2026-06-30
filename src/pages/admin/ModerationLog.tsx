import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, ShieldAlert, Check } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

type Filter = 'blocked' | 'overridden' | 'all'

function fmt(ts: string) {
  return new Date(ts).toLocaleString()
}

export default function ModerationLog() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [filter, setFilter] = useState<Filter>('blocked')
  const qc = useQueryClient()

  if (authLoading) {
    return <div className="container mx-auto max-w-5xl py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['moderation-log', filter],
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
    enabled: userIds.length > 0,
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
    <div className="container mx-auto max-w-5xl py-6 space-y-6">
      <SEO title="Moderation Log" description="Admin review of AI-moderated thread submissions." path="/admin/moderation" />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" /> Moderation Log
          </h1>
          <p className="text-sm text-muted-foreground">Review AI-flagged thread submissions and override false positives.</p>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
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
    </div>
  )
}
