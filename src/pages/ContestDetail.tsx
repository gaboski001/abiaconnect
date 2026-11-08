import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  Award,
  CheckCircle2,
  Copy,
  Globe,
  KeyRound,
  Lock,
  Printer,
  Share2,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
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
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { PrintSheet, printSheet } from '@/components/contests/PrintSheet'
import {
  announceContestResults,
  cancelContest,
  castContestBallot,
  engagementErrorText,
  generateContestCodes,
  getContest,
  GROUP_BLOCK_TEXT,
  positionWinners,
  reviewContest,
  type ContestDetail as Detail,
} from '@/lib/engagement'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { PHASE_STYLE } from './Contests'

const SITE = 'https://abiaconnect.com'

type Cand = Detail['candidates'][number]

export default function ContestDetail() {
  const { contestId } = useParams()
  const { user, isAdmin, loading } = useAuth()
  const qc = useQueryClient()
  const key = ['contest', contestId, user?.id ?? 'guest']
  const q = useQuery({
    queryKey: key,
    queryFn: () => getContest(contestId!),
    enabled: !loading && !!contestId,
    // Live totals refresh while voting is open.
    refetchInterval: (query) => {
      const d = query.state.data as Detail | undefined
      return d && d.phase === 'open' ? 15_000 : false
    },
  })
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [code, setCode] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['contest', contestId] })
    void qc.invalidateQueries({ queryKey: ['contests'] })
  }
  const picked = Object.values(choices).flat()
  const vote = useMutation({
    mutationFn: () => castContestBallot(contestId!, picked, code.trim() || undefined),
    onSuccess: () => {
      toast.success('Your vote has been recorded. Thank you for taking part!')
      setCode('')
      setChoices({})
      refresh()
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })

  // Voting has closed: make sure the group hears about the results.
  const announced = useRef(false)
  const d = q.data
  useEffect(() => {
    if (d && d.phase === 'closed' && !d.results_announced_at && !announced.current) {
      announced.current = true
      void announceContestResults(d.id).catch(() => undefined)
    }
  }, [d])

  if (loading || q.isLoading) return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-muted" />
  if (q.isError || !d) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-[15px] font-semibold">{user ? 'This contest isn’t available.' : 'Sign in to see this contest.'}</p>
        <Link to={user ? '/contests' : '/login'} className="mt-3 inline-block text-[14px] font-semibold text-primary">
          {user ? 'See all contests' : 'Sign in'}
        </Link>
      </div>
    )
  }

  const c = d
  const style = PHASE_STYLE[c.phase]
  const votesFor = (id: string) => c.results?.find((r) => r.candidate_id === id)?.votes ?? 0
  const needsCode = !c.eligible_by_group && c.allow_code_voters
  const canVote = c.signed_in && c.phase === 'open' && !c.has_voted && (c.eligible_by_group || c.allow_code_voters)
  const groups = c.positions.map((p) => ({ ...p, candidates: c.candidates.filter((k) => k.position_id === p.id) }))
  const showPositionTitles = groups.length > 1 || (groups[0] && groups[0].title !== 'Candidates')
  const turnoutPct = c.eligible_members ? Math.min(100, Math.round((c.turnout / c.eligible_members) * 100)) : null
  const link = `${SITE}/contests/${c.id}`

  const toggle = (posId: string, max: number, candId: string) =>
    setChoices((all) => {
      const cur = all[posId] ?? []
      if (cur.includes(candId)) return { ...all, [posId]: cur.filter((x) => x !== candId) }
      if (max === 1) return { ...all, [posId]: [candId] }
      if (cur.length >= max) {
        toast.error(`You can pick up to ${max} here. Untick one first.`)
        return all
      }
      return { ...all, [posId]: [...cur, candId] }
    })

  const share = async () => {
    const text = c.phase === 'closed' ? `Results: ${c.title}` : `${c.title}: follow the vote on AbiaConnect`
    try {
      if (navigator.share) {
        await navigator.share({ title: c.title, text, url: link })
        return
      }
      await navigator.clipboard.writeText(link)
      toast.success('Link copied. Paste it anywhere to share.')
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SEO title={c.title} description={c.description ?? 'Community contest on AbiaConnect.'} path={`/contests/${c.id}`} />

      {/* Summary */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-2">
          <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold', style.className)}>{style.label}</span>
          {c.status === 'approved' ? (
            <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={share}>
              <Share2 className="size-4" /> Share
            </Button>
          ) : null}
        </div>
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
            value={c.phase === 'open' ? `in ${formatDistanceToNowStrict(new Date(c.ends_at))}` : format(new Date(c.ends_at), 'd MMM yyyy, h:mm a')}
          />
          <Info
            label="Who can vote"
            value={[c.allow_group_voters && 'Group members', c.allow_code_voters && 'Voter-code holders'].filter(Boolean).join(' · ')}
          />
          <Info label="Results" value={c.results_visibility === 'live' ? 'Live while voting' : 'After voting closes'} />
        </dl>
        <div className="mt-3 space-y-1.5">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{c.turnout.toLocaleString()}</span> {c.turnout === 1 ? 'person has' : 'people have'} voted
            {c.eligible_members ? (
              <>
                {' '}
                of {c.eligible_members.toLocaleString()} members who can ({turnoutPct}%)
              </>
            ) : null}
          </p>
          {turnoutPct !== null ? (
            <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary/70" style={{ width: `${turnoutPct}%` }} />
            </span>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Chip icon={ShieldCheck}>Secret ballot</Chip>
            {c.members_before_open ? <Chip icon={UserCheck}>Members from before {format(new Date(c.created_at), 'd MMM')} only</Chip> : null}
            {c.min_account_days > 0 ? <Chip icon={UserCheck}>Accounts at least {c.min_account_days} days old</Chip> : null}
            {c.is_public ? <Chip icon={Globe}>Anyone with the link can follow</Chip> : null}
          </div>
        </div>
      </section>

      {/* Status messages */}
      {c.status === 'pending' ? <Notice tone="amber">This contest is waiting for an admin to approve it. Members can’t see it yet.</Notice> : null}
      {c.status === 'rejected' ? <Notice tone="rose">Not approved{c.review_note ? `: ${c.review_note}` : '.'}</Notice> : null}
      {c.has_voted ? (
        <Notice tone="emerald">
          <CheckCircle2 className="mr-1.5 inline size-4" />
          You have voted. Your choice is secret: nobody, including admins, can see who you voted for.
        </Notice>
      ) : null}

      {isAdmin && c.status === 'pending' ? <ReviewPanel id={c.id} onDone={refresh} /> : null}

      {c.phase === 'closed' && c.results ? <Certificate c={c} groups={groups} votesFor={votesFor} onShare={share} /> : null}

      {/* Positions and candidates */}
      {!c.results && c.phase === 'open' && c.results_visibility === 'after_close' ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Lock className="size-4" /> Results stay hidden until voting closes.
        </p>
      ) : null}
      {groups.map((p) => {
        const total = p.candidates.reduce((s, k) => s + votesFor(k.id), 0)
        const { winners, tie } = c.phase === 'closed' && c.results ? positionWinners(p.candidates.map((k) => k.id), votesFor, p.max_choices) : { winners: [], tie: false }
        const mine = choices[p.id] ?? []
        return (
          <section key={p.id} aria-label={p.title}>
            <h2 className="mb-1 flex items-center gap-2 text-[18px] font-bold">
              {c.results ? <Trophy className="size-5 text-amber-500" /> : null}
              {showPositionTitles ? p.title : c.results ? (c.phase === 'closed' ? 'Final results' : 'Live results') : 'Candidates'}
            </h2>
            {canVote ? (
              <p className="mb-2 text-[13px] text-muted-foreground">
                {p.max_choices === 1 ? 'Pick one.' : `Pick up to ${p.max_choices}.`}
                {p.max_choices > 1 ? ` ${mine.length} picked.` : ''}
              </p>
            ) : null}
            {tie ? (
              <p className="mb-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[13px] text-amber-800 dark:text-amber-200">
                It’s a tie. The organiser will say how the tie is settled.
              </p>
            ) : null}
            <div className="space-y-2.5">
              {p.candidates.map((cand) => (
                <CandidateRow
                  key={cand.id}
                  cand={cand}
                  votes={votesFor(cand.id)}
                  total={total}
                  showResults={!!c.results}
                  winner={winners.includes(cand.id)}
                  selectable={canVote}
                  multi={p.max_choices > 1}
                  selected={mine.includes(cand.id)}
                  onSelect={() => toggle(p.id, p.max_choices, cand.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Vote */}
      {canVote ? (
        <section className="sticky bottom-24 z-20 space-y-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur md:static md:shadow-none">
          {needsCode ? (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                <KeyRound className="size-4" /> Your voter code
              </span>
              {c.group_block && c.group_block !== 'no_group_voting' ? (
                <span className="mb-1.5 block text-[12px] text-muted-foreground">{GROUP_BLOCK_TEXT[c.group_block]} If you have a voter code, enter it here.</span>
              ) : null}
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
            disabled={!picked.length || (needsCode && code.trim().length < 8) || vote.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {vote.isPending ? 'Submitting…' : picked.length ? 'Cast my vote' : 'Choose a candidate'}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-4" /> Secret ballot · votes can’t be changed after submitting
          </p>
        </section>
      ) : c.phase === 'open' && !c.has_voted ? (
        !c.signed_in ? (
          <Notice tone="muted">
            Following as a guest.{' '}
            <Link to="/login" className="font-semibold text-primary">
              Sign in
            </Link>{' '}
            if you are allowed to vote.
          </Notice>
        ) : (
          <Notice tone="muted">{GROUP_BLOCK_TEXT[c.group_block ?? 'not_member']}</Notice>
        )
      ) : null}

      {c.is_manager ? <ManagerTools c={c} onChange={refresh} /> : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your vote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-[14px]">
                <ul className="space-y-1">
                  {groups.map((p) => {
                    const names = (choices[p.id] ?? []).map((id) => c.candidates.find((k) => k.id === id)?.name).filter(Boolean)
                    return (
                      <li key={p.id}>
                        {showPositionTitles ? <span className="text-muted-foreground">{p.title}: </span> : null}
                        <strong className="text-foreground">{names.length ? names.join(', ') : 'No choice'}</strong>
                      </li>
                    )
                  })}
                </ul>
                <p>Your vote is secret and can’t be changed afterwards.</p>
              </div>
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

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function CandidateRow({
  cand,
  votes,
  total,
  showResults,
  winner,
  selectable,
  multi,
  selected,
  onSelect,
}: {
  cand: Cand
  votes: number
  total: number
  showResults: boolean
  winner: boolean
  selectable: boolean
  multi: boolean
  selected: boolean
  onSelect: () => void
}) {
  const pct = total ? Math.round((votes / total) * 100) : 0
  const body = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[16px] font-bold text-primary">
        {cand.photo_url ? <img src={cand.photo_url} alt="" className="size-full object-cover" /> : initials(cand.name)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
          {cand.name}
          {winner ? <Trophy className="size-4 text-amber-500" aria-label="Winner" /> : null}
        </span>
        {cand.bio ? <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{cand.bio}</span> : null}
        {showResults ? (
          <span className="mt-2 block">
            <span className="block h-2 overflow-hidden rounded-full bg-muted">
              <span className={cn('block h-full rounded-full', winner ? 'bg-amber-400' : 'bg-primary/60')} style={{ width: `${pct}%` }} />
            </span>
            <span className="mt-1 block text-[12px] text-muted-foreground">
              {votes.toLocaleString()} {votes === 1 ? 'vote' : 'votes'} · {pct}%
            </span>
          </span>
        ) : null}
      </span>
      {selectable ? (
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center border-2',
            multi ? 'rounded-md' : 'rounded-full',
            selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
          )}
          aria-hidden
        >
          {selected ? (
            multi ? (
              <CheckCircle2 className="size-4 text-primary-foreground" />
            ) : (
              <span className="size-2 rounded-full bg-primary-foreground" />
            )
          ) : null}
        </span>
      ) : null}
    </>
  )
  return selectable ? (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border bg-card p-4 transition-colors',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
      )}
    >
      {body}
    </button>
  ) : (
    <div className={cn('flex items-start gap-3 rounded-2xl border bg-card p-4', winner ? 'border-amber-400/60' : 'border-border')}>{body}</div>
  )
}

/** The official result: on screen, and as a printable certificate. */
function Certificate({
  c,
  groups,
  votesFor,
  onShare,
}: {
  c: Detail
  groups: Array<Detail['positions'][number] & { candidates: Cand[] }>
  votesFor: (id: string) => number
  onShare: () => void
}) {
  const rows = groups.map((p) => {
    const { winners, tie } = positionWinners(p.candidates.map((k) => k.id), votesFor, p.max_choices)
    const names = winners.map((id) => p.candidates.find((k) => k.id === id)!)
    return { p, names, tie }
  })
  const ref = c.id.slice(0, 8).toUpperCase()
  const native = isNativeApp()
  return (
    <section className="rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-400/10 to-card p-5">
      <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        <Award className="size-4" /> Official result
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map(({ p, names, tie }) => (
          <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 pb-2 last:border-0">
            <span className="text-[13px] text-muted-foreground">{groups.length > 1 || p.title !== 'Candidates' ? p.title : 'Winner'}</span>
            <span className="text-[15px] font-bold text-foreground">
              {names.length ? names.map((k) => `${k.name} (${votesFor(k.id).toLocaleString()})`).join(', ') : 'No votes'}
              {tie ? ' · tie to settle' : ''}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground">
        {c.turnout.toLocaleString()} {c.turnout === 1 ? 'person' : 'people'} voted · closed {format(new Date(c.ends_at), 'd MMM yyyy, h:mm a')} · reference {ref}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!native ? (
          <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => printSheet('certificate')}>
            <Printer className="size-4" /> Print or save certificate
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={onShare}>
          <Share2 className="size-4" /> Share results
        </Button>
      </div>

      <PrintSheet id="certificate">
        <div style={{ fontFamily: 'Georgia, serif', border: '6px double #b8860b', padding: '28px 32px', textAlign: 'center' }}>
          <p style={{ letterSpacing: 4, fontSize: 12, textTransform: 'uppercase', margin: 0 }}>AbiaConnect · Certificate of Result</p>
          <h1 style={{ fontSize: 28, margin: '14px 0 4px' }}>{c.title}</h1>
          {c.subgroup_name ? <p style={{ margin: 0, fontSize: 15 }}>{c.subgroup_name}</p> : null}
          <p style={{ margin: '6px 0 18px', fontSize: 13 }}>
            Voting held {format(new Date(c.starts_at), 'd MMMM yyyy')} to {format(new Date(c.ends_at), 'd MMMM yyyy, h:mm a')}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Arial, sans-serif', fontSize: 13, textAlign: 'left' }}>
            <tbody>
              {groups.map((p) => {
                const total = p.candidates.reduce((s, k) => s + votesFor(k.id), 0)
                const row = rows.find((r) => r.p.id === p.id)!
                return [
                  <tr key={`${p.id}-h`}>
                    <th colSpan={3} style={{ padding: '10px 0 4px', borderBottom: '1px solid #999', fontSize: 14 }}>
                      {p.title}
                      {p.max_choices > 1 ? ` (top ${p.max_choices} elected)` : ''}
                      {row.tie ? ' · tie to be settled by the organiser' : ''}
                    </th>
                  </tr>,
                  ...[...p.candidates]
                    .sort((a, b) => votesFor(b.id) - votesFor(a.id))
                    .map((k) => (
                      <tr key={k.id}>
                        <td style={{ padding: '3px 0', fontWeight: row.names.some((n) => n.id === k.id) ? 700 : 400 }}>
                          {row.names.some((n) => n.id === k.id) ? '★ ' : ''}
                          {k.name}
                        </td>
                        <td style={{ textAlign: 'right' }}>{votesFor(k.id).toLocaleString()} votes</td>
                        <td style={{ textAlign: 'right', width: 60 }}>{total ? Math.round((votesFor(k.id) / total) * 100) : 0}%</td>
                      </tr>
                    )),
                ]
              })}
            </tbody>
          </table>
          <p style={{ marginTop: 18, fontSize: 12 }}>
            {c.turnout.toLocaleString()} people voted
            {c.eligible_members ? ` out of ${c.eligible_members.toLocaleString()} members allowed to vote` : ''}. Secret ballot: no one, including the
            organisers, can see how anyone voted. Each person could vote only once.
          </p>
          <p style={{ marginTop: 8, fontSize: 11 }}>
            Reference {ref} · Check this result at {SITE}/contests/{c.id}
          </p>
        </div>
      </PrintSheet>
    </section>
  )
}

function Chip({ icon: Icon, children }: { icon: typeof ShieldCheck; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
      <Icon className="size-3.5" /> {children}
    </span>
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
      <p className="text-[13px] text-muted-foreground">Check the title, positions, candidates and dates. Approving makes it visible and notifies the group.</p>
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
  const native = isNativeApp()
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
            <span className="font-semibold text-foreground">{c.codes.total}</span>. Give one code to each voter, like a ballot paper. Each works
            once.
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
                Save or print these now. For security they are shown only once.
              </p>
              <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-[13px] leading-6">{codes.join('\n')}</pre>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={copyAll} className="h-10 rounded-xl">
                  <Copy className="size-4" /> Copy all codes
                </Button>
                {!native ? (
                  <Button variant="outline" onClick={() => printSheet('slips')} className="h-10 rounded-xl">
                    <Printer className="size-4" /> Print ballot slips
                  </Button>
                ) : null}
              </div>
              <PrintSheet id="slips">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, fontFamily: 'Arial, sans-serif' }}>
                  {codes.map((k) => (
                    <div key={k} style={{ border: '1px dashed #888', padding: '12px 14px', breakInside: 'avoid' }}>
                      <p style={{ margin: 0, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>AbiaConnect ballot slip</p>
                      <p style={{ margin: '4px 0', fontSize: 13, fontWeight: 700 }}>{c.title}</p>
                      <p style={{ margin: '6px 0', fontSize: 22, fontFamily: 'monospace', letterSpacing: 3 }}>{k}</p>
                      <p style={{ margin: 0, fontSize: 10, lineHeight: 1.4 }}>
                        Open {SITE}/contests/{c.id} (or this contest in the AbiaConnect app), sign in, make your choice, enter this code and submit. The code works once. Closes {format(new Date(c.ends_at), 'd MMM yyyy, h:mm a')}.
                      </p>
                    </div>
                  ))}
                </div>
              </PrintSheet>
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
