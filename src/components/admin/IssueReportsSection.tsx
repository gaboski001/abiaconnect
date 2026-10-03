import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, CheckCircle2, Eye, Flag, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

type IssueReport = {
  id: string
  type: string
  description: string
  page_url: string | null
  contact_email: string | null
  status: string
  created_at: string
}

const isChildSafety = (r: IssueReport) => /child safety/i.test(r.type)

/**
 * Admin -> Problem reports: everything sent from "Report a problem".
 * Child safety reports are pinned to the top until resolved.
 */
export default function IssueReportsSection() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const q = useQuery({
    queryKey: ['admin-issue-reports', filter],
    queryFn: async () => {
      let query = supabase
        .from('issue_reports')
        .select('id, type, description, page_url, contact_email, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (filter === 'open') query = query.neq('status', 'resolved')
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as IssueReport[]
      // Child safety first, then newest.
      return [...rows.filter(isChildSafety), ...rows.filter((r) => !isChildSafety(r))]
    },
    refetchInterval: 30000,
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('issue_reports').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-issue-reports'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = q.data ?? []
  const urgent = rows.filter((r) => isChildSafety(r) && r.status !== 'resolved').length

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold flex items-center gap-2">
          <Flag className="size-4" /> Problem reports
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === 'open' ? 'default' : 'outline'} onClick={() => setFilter('open')}>
            Open
          </Button>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
            All
          </Button>
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={q.isFetching ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>
      </div>

      {urgent > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <strong>{urgent} child safety report{urgent === 1 ? '' : 's'}</strong> waiting. Review these first: remove the
            content, ban the account if needed, and report child sexual abuse material to the authorities (see the Child
            Safety Standards page).
          </p>
        </div>
      )}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load reports.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {filter === 'open' ? 'No open reports.' : 'No reports yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border p-4 space-y-2 ${isChildSafety(r) && r.status !== 'resolved' ? 'border-destructive/50 bg-destructive/5' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-sm">{r.type}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })} · {r.status}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">{r.description}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {r.page_url && (
                  <a href={r.page_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                    {r.page_url}
                  </a>
                )}
                {r.contact_email && (
                  <a href={`mailto:${r.contact_email}`} className="text-primary underline">
                    {r.contact_email}
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                {r.status !== 'reviewing' && r.status !== 'resolved' && (
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: 'reviewing' })}>
                    <Eye /> Reviewing
                  </Button>
                )}
                {r.status !== 'resolved' ? (
                  <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: 'resolved' })}>
                    <CheckCircle2 /> Resolved
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: 'open' })}>
                    Reopen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
