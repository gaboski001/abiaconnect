import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { CheckCircle2, Copy, KeyRound, Lock, ShieldCheck, Trophy, Users, XCircle } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/AuthContext'
import {
  cancelContest,
  castContestVote,
  engagementErrorText,
  generateContestCodes,
  getContest,
  reviewContest,
  type ContestDetail as Detail,
} from '@/lib/engagement'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { PHASE_STYLE } from './Contests'

export default function ContestDetail() {
  const { contestId } = useParams()
  const { user, isAdmin, loading } = useAuth()
  const qc = useQueryClient()
  const key = ['contest', contestId]
  const q = useQuery({
    queryKey: key,
    queryFn: () => getContest(contestId!),
    enabled: !!user && !!contestId,
    // Live totals refresh while voting is open.
    refetchInterval: (query) => {
      const d = query.state.data as Detail | undefined
      return d && d.phase === 'open' ? 15_000 : false
    },
  })
  const [choice, setChoice] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key })
    void qc.invalidateQueries({ queryKey: ['contests'] })
  }
  const vote = useMutation({
    mutationFn: () => castContestVote(contestId!, choice!, code.trim() || undefined),
    onSuccess: () => {
      toast.success('Your vote has been recorded. Thank you for taking part!')
      setCode('')
      refresh()
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })

  if (!loading && !user) return <Navigate to="/login" replace />
  if (q.isLoading) return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-muted" />
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-[15px] font-semibold">This contest isn’t available.</p>
        <Link to="/contests" className="mt-3 inline-block text-[14px] font-semibold text-primary">
          See all contests
        </Link>
      </div>
    )
  }

  const c = q.data
  const style = PHASE_STYLE[c.phase]
  const totalVotes = c.results?.reduce((s, r) => s + r.votes, 0) ?? 0
  const maxVotes = Math.max(0, ...(c.results?.map((r) => r.votes) ?? [0]))
  const votesFor = (id: string) => c.results?.find((r) => r.candidate_id === id)?.votes ?? 0
  const needsCode = !c.eligible_by_group && c.allow_code_voters
  const canVote = c.phase === 'open' && !c.has_voted && (c.eligible_by_group || c.allow_code_voters)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SEO title={c.title} description={c.description ?? 'Community contest on AbiaConnect.'} path={`/contests/${c.id}`} />

      {/* Summary */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold', style.className)}>{style.label}</span>
        <h1 className="mt-2 text-[22px] font-extrabold leading-tight text-foreground">{c.title}</h1>
        {c.subgroup_name ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground">
            <Users className="size-4" /> {c.subgroup_name}
          </p>
        ) : null}
        {c.description ? <p className="mt-3 whitespace-pre-line text-[15px] leading-6 text-muted-foreground">{c.description}</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[13px]">
          <Info label="Opens" value={format(new Date(c.starts_at), 'd MMM yyyy, h:mm a')} />
          <Info
            label={c.phase === 'closed' ? 'Closed' : 'Closes'}
            value={
              c.phase === 'open'
                ? `in ${formatDistanceToNowStrict(new Date(c.ends_at))}`
                : format(new Date(c.ends_at), 'd MMM yyyy, h:mm a')
            }
          />
          <Info
            label="Who can vote"
            value={[c.allow_group_voters && 'Group members', c.allow_code_voters && 'Voter-code holders'].filter(Boolean).join(' · ')}
          />
          <Info label="Results" value={c.results_visibility === 'live' ? 'Live while voting' : 'After voting closes'} />
        </dl>
        <p className="mt-3 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{c.turnout.toLocaleString()}</span> {c.turnout === 1 ? 'vote' : 'votes'} cast so far
        </p>
      </section>

      {/* Status messages */}
      {c.status === 'pending' ? (
        <Notice tone="amber">This contest is waiting for an admin to approve it. Members can’t see it yet.</Notice>
      ) : null}
      {c.status === 'rejected' ? (
        <Notice tone="rose">Not approved{c.review_note ? `: ${c.review_note}` : '.'}</Notice>
      ) : null}
      {c.has_voted ? (
        <Notice tone="emerald">
          <CheckCircle2 className="mr-1.5 inline size-4" />
          You have voted. Your choice is secret: nobody, including admins, can see who you voted for.
        </Notice>
      ) : null}

      {isAdmin && c.status === 'pending' ? <ReviewPanel id={c.id} onDone={refresh} /> : null}

      {/* Candidates / results */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold">
          {c.results ? (
            <>
              <Trophy className="size-5 text-amber-500" /> {c.phase === 'closed' ? 'Final results' : 'Live results'}
            </>
          ) : (
            'Candidates'
          )}
        </h2>
        {!c.results && c.phase === 'open' && c.results_visibility === 'after_close' ? (
          <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Lock className="size-4" /> Results stay hidden until voting closes.
          </p>
        ) : null}
        <div className="space-y-2.5" role={canVote ? 'radiogroup' : undefined} aria-label="Candidates">
          {c.candidates.map((cand) => {
            const votes = votesFor(cand.id)
            const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0
            const winner = c.phase === 'closed' && c.results && votes === maxVotes && maxVotes > 0
            const selected = choice === cand.id
            const Body = (
              <>
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[16px] font-bold text-primary">
                  {cand.photo_url ? (
                    <img src={cand.photo_url} alt="" className="size-full object-cover" />
                  ) : (
                    cand.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                    {cand.name}
                    {winner ? <Trophy className="size-4 text-amber-500" aria-label="Winner" /> : null}
                  </span>
                  {cand.bio ? <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{cand.bio}</span> : null}
                  {c.results ? (
                    <span className="mt-2 block">
                      <span className="block h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn('block h-full rounded-full', winner ? 'bg-amber-400' : 'bg-primary/60')}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="mt-1 block text-[12px] text-muted-foreground">
                        {votes.toLocaleString()} {votes === 1 ? 'vote' : 'votes'} · {pct}%
                      </span>
                    </span>
                  ) : null}
                </span>
                {canVote ? (
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                      selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )}
                    aria-hidden
                  >
                    {selected ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
                  </span>
                ) : null}
              </>
            )
            return canVote ? (
              <button
                key={cand.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(cand.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border bg-card p-4 transition-colors',
                  selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                )}
              >
                {Body}
              </button>
            ) : (
              <div key={cand.id} className={cn('flex items-start gap-3 rounded-2xl border bg-card p-4', winner ? 'border-amber-400/60' : 'border-border')}>
                {Body}
              </div>
            )
          })}
        </div>
      </section>

      {/* Vote */}
      {canVote ? (
        <section className="sticky bottom-24 z-20 space-y-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur md:static md:shadow-none">
          {needsCode ? (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <KeyRound className="size-4" /> Your voter code
              </span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7QM-2XPA"
                autoCapitalize="characters"
                autoComplete="off"
                className="h-12 text-center font-mono text-[16px] tracking-widest"
              />
            </label>
          ) : null}
          <Button
            className="h-12 w-full rounded-xl text-[15px] font-bold"
            disabled={!choice || (needsCode && code.trim().length < 8) || vote.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {vote.isPending ? 'Submitting…' : choice ? 'Cast my vote' : 'Choose a candidate'}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-4" /> Secret ballot · votes can’t be changed after submitting
          </p>
        </section>
      ) : c.phase === 'open' && !c.has_voted ? (
        <Notice tone="muted">Only members of this contest’s group can vote here.</Notice>
      ) : null}

      {c.is_manager ? <ManagerTools c={c} onChange={refresh} /> : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your vote</AlertDialogTitle>
            <AlertDialogDescription>
              You are voting for <strong>{c.candidates.find((x) => x.id === choice)?.name}</strong>. Your vote is secret and
              can’t be changed afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => vote.mutate()}>Submit vote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'amber' | 'rose' | 'emerald' | 'muted'; children: React.ReactNode }) {
  const tones = {
    amber: 'border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-200',
    rose: 'border-rose-400/40 bg-rose-400/10 text-rose-700 dark:text-rose-200',
    emerald: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-800 dark:text-emerald-200',
    muted: 'border-border bg-muted/60 text-muted-foreground',
  }
  return <div className={cn('rounded-2xl border px-4 py-3 text-[14px] leading-6', tones[tone])}>{children}</div>
}

function ReviewPanel({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState('')
  const review = useMutation({
    mutationFn: (approve: boolean) => reviewContest(id, approve, note),
    onSuccess: (_d, approve) => {
      toast.success(approve ? 'Contest approved. Group members have been notified.' : 'Contest rejected. The organiser has been told.')
      onDone()
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })
  return (
    <section className="space-y-3 rounded-2xl border border-amber-400/40 bg-card p-4">
      <h2 className="text-[16px] font-bold">Admin review</h2>
      <p className="text-[13px] text-muted-foreground">Check the title, candidates and dates. Approving makes it visible and notifies the group.</p>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the organiser (optional, shown if rejected)" rows={2} />
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="outline" disabled={review.isPending} onClick={() => review.mutate(false)} className="h-11 rounded-xl">
          <XCircle className="size-4" /> Reject
        </Button>
        <Button disabled={review.isPending} onClick={() => review.mutate(true)} className="h-11 rounded-xl">
          <CheckCircle2 className="size-4" /> Approve
        </Button>
      </div>
    </section>
  )
}

function ManagerTools({ c, onChange }: { c: Detail; onChange: () => void }) {
  const [count, setCount] = useState(20)
  const [codes, setCodes] = useState<string[]>([])
  const gen = useMutation({
    mutationFn: () => generateContestCodes(c.id, count),
    onSuccess: (list) => {
      setCodes(list)
      onChange()
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })
  const cancel = useMutation({
    mutationFn: () => cancelContest(c.id),
    onSuccess: () => {
      toast.success('Contest cancelled.')
      onChange()
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      toast.success('Codes copied')
    } catch {
      toast.error('Could not copy. Select the codes and copy them manually.')
    }
  }
  const active = c.status !== 'rejected' && c.status !== 'cancelled' && c.phase !== 'closed'

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[16px] font-bold">Organiser tools</h2>
      {c.allow_code_voters && c.codes ? (
        <div className="space-y-3">
          <p className="text-[14px] text-muted-foreground">
            Voter codes: <span className="font-semibold text-foreground">{c.codes.used}</span> used of{' '}
            <span className="font-semibold text-foreground">{c.codes.total}</span>. Give one code to each voter, like a ballot paper.
            Each works once.
          </p>
          {active ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="h-11 w-24"
                aria-label="How many codes"
              />
              <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="h-11 flex-1 rounded-xl">
                <KeyRound className="size-4" /> {gen.isPending ? 'Creating…' : `Create ${count} codes`}
              </Button>
            </div>
          ) : null}
          {codes.length ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
              <p className="mb-2 text-[13px] font-semibold text-amber-700 dark:text-amber-300">
                Save these now. For security they are shown only once.
              </p>
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-[13px] leading-6">{codes.join('\n')}</pre>
              <Button variant="outline" onClick={copyAll} className="mt-2 h-10 w-full rounded-xl">
                <Copy className="size-4" /> Copy all codes
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {active && (c.status === 'pending' || c.status === 'approved') ? (
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm('Cancel this contest? Votes will no longer be accepted.')) cancel.mutate()
          }}
          disabled={cancel.isPending}
          className="h-11 w-full rounded-xl border-rose-400/40 text-rose-600 dark:text-rose-300"
        >
          Cancel contest
        </Button>
      ) : null}
    </section>
  )
}
