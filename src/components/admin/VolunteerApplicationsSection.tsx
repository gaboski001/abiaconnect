import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, EyeOff, HandHelping, MailCheck, MailWarning, RefreshCw, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { volunteerRoleName } from '@/lib/volunteerRoles'

type Status = 'pending' | 'approved' | 'declined' | 'ignored'
type Decision = 'approve' | 'decline' | 'ignore'

type Application = {
  id: string
  full_name: string
  email: string
  phone: string | null
  location: string
  lga: string | null
  role: string
  hours_per_week: string
  motivation: string
  experience: string
  links: string | null
  answers: { question: string; answer: string }[]
  status: Status
  admin_note: string | null
  reviewed_at: string | null
  decision_emailed_at: string | null
  created_at: string
}

const FILTERS: { id: Status | 'all'; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' },
  { id: 'ignored', label: 'Ignored' },
  { id: 'all', label: 'All' },
]

const STATUS_STYLE: Record<Status, string> = {
  pending: 'bg-secondary/15 text-secondary border-secondary/30',
  approved: 'bg-primary/15 text-primary border-primary/30',
  declined: 'bg-destructive/10 text-destructive border-destructive/30',
  ignored: 'bg-muted text-muted-foreground border-border',
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Waiting for review',
  approved: 'Approved',
  declined: 'Declined',
  ignored: 'Ignored',
}

// The table and function are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

function Answer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">{children}</p>
    </div>
  )
}

/**
 * Admin -> Volunteer Applications: everything sent from the "Apply to
 * Volunteer" form. Approving or declining emails the applicant; ignoring
 * sends nothing and can be undone by approving or declining later.
 */
export default function VolunteerApplicationsSection() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Status | 'all'>('pending')
  const [open, setOpen] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<{ app: Application; decision: 'approve' | 'decline' } | null>(null)
  const [note, setNote] = useState('')

  const q = useQuery({
    queryKey: ['admin-volunteer-applications', filter],
    queryFn: async () => {
      let query = db.from('volunteer_applications').select('*').order('created_at', { ascending: false }).limit(200)
      if (filter !== 'all') query = query.eq('status', filter)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Application[]
    },
    refetchInterval: 60000,
  })

  const decide = useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: Decision; note?: string }) => {
      const { data, error } = await supabase.functions.invoke('volunteer-decide', { body: { id, decision, note } })
      if (error) {
        let message: string | undefined
        try {
          message = (await (error as { context?: Response }).context?.json())?.error
        } catch {
          /* ignore */
        }
        throw new Error(message || 'Could not save the decision. Please try again.')
      }
      return { decision, emailed: data?.emailed === true }
    },
    onSuccess: ({ decision, emailed }) => {
      setDeciding(null)
      setNote('')
      qc.invalidateQueries({ queryKey: ['admin-volunteer-applications'] })
      if (decision === 'ignore') toast.success('Application ignored. No email was sent.')
      else if (emailed) toast.success(decision === 'approve' ? 'Approved. The applicant has been emailed.' : 'Declined. The applicant has been emailed.')
      else toast.error('The decision is saved, but the email could not be sent. Please email the applicant yourself.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = q.data ?? []

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          <HandHelping className="size-4" /> Volunteer applications
        </h2>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={q.isFetching ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Approve or Decline sends the applicant an email straight away and cannot be changed afterwards. Ignore sends
        nothing; you can still approve or decline an ignored application later.
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.id} size="sm" variant={filter === f.id ? 'default' : 'outline'} onClick={() => setFilter(f.id)}>
            {f.label}
          </Button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load the applications.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {filter === 'pending' ? 'No applications are waiting for review.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            const expanded = open === a.id
            const undecided = a.status === 'pending' || a.status === 'ignored'
            return (
              <li key={a.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{a.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {volunteerRoleName(a.role)} · {a.hours_per_week} · {a.location}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <a href={`mailto:${a.email}`} className="break-all text-primary underline">
                    {a.email}
                  </a>
                  {a.phone && <span className="text-muted-foreground">{a.phone}</span>}
                  {a.lga && <span className="text-muted-foreground">LGA: {a.lga}</span>}
                </div>

                {expanded && (
                  <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                    <Answer label="Why they want to volunteer">{a.motivation}</Answer>
                    <Answer label="Experience and skills">{a.experience}</Answer>
                    {a.links && <Answer label="Links">{a.links}</Answer>}
                    {(a.answers ?? []).map((x) => (
                      <Answer key={x.question} label={x.question}>
                        {x.answer}
                      </Answer>
                    ))}
                    {a.admin_note && <Answer label="Your note to the applicant">{a.admin_note}</Answer>}
                  </div>
                )}

                {(a.status === 'approved' || a.status === 'declined') && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {a.decision_emailed_at ? (
                      <>
                        <MailCheck className="size-3.5" /> The applicant was emailed.
                      </>
                    ) : (
                      <>
                        <MailWarning className="size-3.5 text-destructive" /> The email was not sent. Please email the
                        applicant yourself.
                      </>
                    )}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen(expanded ? null : a.id)}>
                    {expanded ? 'Hide answers' : 'Read answers'}
                  </Button>
                  {undecided && (
                    <>
                      <Button size="sm" onClick={() => setDeciding({ app: a, decision: 'approve' })}>
                        <CheckCircle2 /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeciding({ app: a, decision: 'decline' })}>
                        <XCircle /> Decline
                      </Button>
                    </>
                  )}
                  {a.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: a.id, decision: 'ignore' })}
                    >
                      <EyeOff /> Ignore
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={!!deciding}
        onOpenChange={(v) => {
          if (!v && !decide.isPending) {
            setDeciding(null)
            setNote('')
          }
        }}
      >
        <DialogContent>
          {deciding && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {deciding.decision === 'approve' ? 'Approve' : 'Decline'} {deciding.app.full_name}?
                </DialogTitle>
                <DialogDescription>
                  {deciding.decision === 'approve'
                    ? 'They will get an email saying the application is approved and that the team will contact them within a few days.'
                    : 'They will get a polite email saying we cannot offer a role at this time and that they may apply again.'}{' '}
                  It goes to {deciding.app.email} and cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="volunteer-note">Personal note in the email (optional)</Label>
                <Textarea
                  id="volunteer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={
                    deciding.decision === 'approve'
                      ? 'For example: who will contact them, or when the introduction call will be.'
                      : 'For example: a kind word, or what would strengthen a future application.'
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeciding(null)} disabled={decide.isPending}>
                  Cancel
                </Button>
                <Button
                  variant={deciding.decision === 'approve' ? 'default' : 'destructive'}
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: deciding.app.id, decision: deciding.decision, note })}
                >
                  {decide.isPending ? 'Sending…' : deciding.decision === 'approve' ? 'Approve and send email' : 'Decline and send email'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
