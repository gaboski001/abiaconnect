import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, CloudUpload, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args)

interface BackupRun {
  started_at: string
  finished_at: string | null
  ok: boolean | null
  db_snapshot: string | null
  tables_saved: number
  rows_saved: number
  files_copied: number
  files_left: number | null
  error: string | null
}

interface BackupView {
  enabled: boolean
  last_snapshot: string | null
  files_saved: number
  runs: BackupRun[]
}

const ago = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true })

/**
 * Admin -> Backups. Every night a copy of new photos and files goes to the
 * owner's Cloudflare R2 storage; once a week every table and the member list
 * go there too. This page shows whether that is working.
 */
export default function BackupsSection() {
  const view = useQuery({
    queryKey: ['admin-backup-status'],
    queryFn: async () => {
      const { data, error } = await rpc('admin_backup_status')
      if (error) throw error
      return data as BackupView
    },
  })
  const v = view.data

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-bold">
          <CloudUpload className="size-4" /> Off-site backups
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A copy of the site is kept in your own Cloudflare storage, outside the hosting company, in case anything goes wrong there.
        </p>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Every night at 2:30am: new and changed photos and files.</li>
        <li>Once a week: every table (posts, members, messages, groups, contests…) and the member account list, without passwords.</li>
        <li>Old weekly copies are removed automatically after 90 days.</li>
      </ul>

      {view.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : view.isError || !v ? (
        <p className="text-sm text-muted-foreground">The backup log isn’t available right now.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Last full copy of the database</p>
              <p className="font-semibold">{v.last_snapshot ? ago(v.last_snapshot) : 'Not yet'}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Photos and files saved</p>
              <p className="font-semibold">{v.files_saved.toLocaleString()}</p>
            </div>
          </div>

          {v.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backup has run yet. The first one runs tonight.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {v.runs.map((r) => (
                <li key={r.started_at} className="flex items-start gap-3 p-3 text-sm">
                  {r.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Worked" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{ago(r.started_at)}</p>
                    <p className="text-muted-foreground">
                      {r.ok === null
                        ? 'Still running or stopped part-way.'
                        : r.ok
                          ? [
                              r.db_snapshot ? `${r.tables_saved} tables, ${r.rows_saved.toLocaleString()} rows saved` : null,
                              `${r.files_copied} files copied`,
                              r.files_left ? `${r.files_left} still to copy` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : `Failed: ${r.error ?? 'unknown reason'}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
