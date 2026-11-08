import { useQuery } from '@tanstack/react-query'
import { Clock3, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchMySubmissions, type MySubmission } from '@/lib/communityPages'

const STATUS: Record<string, { label: string; Icon: typeof Clock3; tone: string }> = {
  pending: { label: 'Waiting for review', Icon: Clock3, tone: 'text-amber-600 dark:text-amber-400' },
  published: { label: 'Published', Icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
  featured: { label: 'Featured', Icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
  declined: { label: 'Not published', Icon: XCircle, tone: 'text-muted-foreground' },
  dismissed: { label: 'Not chosen this time', Icon: XCircle, tone: 'text-muted-foreground' },
  removed: { label: 'Taken down', Icon: XCircle, tone: 'text-muted-foreground' },
}

/** "What you sent in" on a community page, so members see where their submission stands. */
export function SubmissionStatus({ kind }: { kind: MySubmission['kind'] }) {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['my-community-submissions', user?.id], enabled: !!user, queryFn: fetchMySubmissions })
  const mine = (q.data ?? []).filter((s) => s.kind === kind).slice(0, 5)
  if (!mine.length) return null

  return (
    <section aria-label="What you sent in" className="not-prose my-6 rounded-2xl border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">What you sent in</h2>
      <ul className="space-y-2">
        {mine.map((s) => {
          const st = STATUS[s.status] ?? STATUS.pending
          return (
            <li key={s.id} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate">{s.title}</span>
                <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${st.tone}`}>
                  <st.Icon className="size-3.5" /> {st.label}
                </span>
              </div>
              {s.review_note ? <p className="mt-0.5 text-xs text-muted-foreground">Note from the team: {s.review_note}</p> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default SubmissionStatus
