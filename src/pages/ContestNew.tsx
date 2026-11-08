import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, Info, LayoutTemplate, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { createElection, engagementErrorText } from '@/lib/engagement'
import { CONTEST_TEMPLATES, type ContestTemplate } from '@/lib/contestTemplates'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

interface Cand {
  name: string
  bio: string
}
interface Pos {
  title: string
  max_choices: number
  candidates: Cand[]
}

const blankCands = (): Cand[] => [
  { name: '', bio: '' },
  { name: '', bio: '' },
]

export default function ContestNew() {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const groups = useQuery({
    queryKey: ['contest-groups', user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from('subgroups').select('id, name').eq('is_active', true).order('name')
      if (!isAdmin) query = query.eq('created_by', user!.id)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string }>
    },
  })

  const now = useMemo(() => new Date(), [])
  const [template, setTemplate] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subgroupId, setSubgroupId] = useState<string>('')
  const [groupVoters, setGroupVoters] = useState(true)
  const [codeVoters, setCodeVoters] = useState(false)
  const [membersBefore, setMembersBefore] = useState(true)
  const [minDays, setMinDays] = useState(0)
  const [isPublic, setIsPublic] = useState(true)
  const [visibility, setVisibility] = useState<'after_close' | 'live'>('after_close')
  const [startsAt, setStartsAt] = useState(toLocalInput(now))
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(now.getTime() + 3 * 86400_000)))
  const [positions, setPositions] = useState<Pos[]>([{ title: 'Candidates', max_choices: 1, candidates: blankCands() }])

  // Group owners always run contests for one of their groups: preselect it.
  useEffect(() => {
    if (!isAdmin && !subgroupId && groups.data?.length) setSubgroupId(groups.data[0].id)
  }, [isAdmin, subgroupId, groups.data])

  const applyTemplate = (t: ContestTemplate) => {
    setTemplate(t.id)
    setTitle(`${t.title} ${new Date().getFullYear()}`)
    setDescription(t.description)
    setVisibility(t.resultsVisibility)
    setEndsAt(toLocalInput(new Date(new Date(startsAt).getTime() + t.days * 86400_000)))
    setPositions(t.positions.map((p) => ({ ...p, candidates: blankCands().concat(p.max_choices > 1 ? blankCands() : []) })))
  }

  const noGroup = !subgroupId
  const create = useMutation({
    mutationFn: () =>
      createElection({
        title: title.trim(),
        description: description.trim(),
        subgroupId: subgroupId || null,
        allowGroupVoters: !noGroup && groupVoters,
        allowCodeVoters: codeVoters || noGroup,
        resultsVisibility: visibility,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        membersBeforeOpen: !noGroup && groupVoters && membersBefore,
        minAccountDays: minDays,
        isPublic,
        positions: positions.map((p) => {
          const candidates = p.candidates.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), bio: c.bio.trim() || undefined }))
          return { title: p.title.trim(), max_choices: Math.min(p.max_choices, Math.max(1, candidates.length)), candidates }
        }),
      }),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['contests'] })
      toast.success(isAdmin ? 'Contest published.' : 'Contest sent for approval. We’ll notify you when an admin reviews it.')
      navigate(`/contests/${id}`, { replace: true })
    },
    onError: (e) => toast.error(engagementErrorText(e)),
  })

  if (!loading && !user) return <Navigate to="/login" replace />
  if (groups.isSuccess && !isAdmin && groups.data.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 text-center text-[14px] text-muted-foreground">
        Contests can be created by admins and by group owners for their own groups. Create a group first, then come back here.
      </div>
    )
  }

  const updatePos = (i: number, patch: Partial<Pos>) => setPositions((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const updateCand = (i: number, k: number, patch: Partial<Cand>) =>
    updatePos(i, { candidates: positions[i].candidates.map((c, j) => (j === k ? { ...c, ...patch } : c)) })
  const movePos = (i: number, by: number) =>
    setPositions((list) => {
      const next = [...list]
      const [p] = next.splice(i, 1)
      next.splice(i + by, 0, p)
      return next
    })

  const filled = positions.map((p) => p.candidates.filter((c) => c.name.trim()).length)
  const total = filled.reduce((a, b) => a + b, 0)
  const valid =
    title.trim().length >= 3 &&
    positions.every((p, i) => p.title.trim() && filled[i] >= 1) &&
    total >= 2 &&
    new Date(endsAt) > new Date(startsAt) &&
    new Date(endsAt) > new Date() &&
    (isAdmin || !noGroup) &&
    (noGroup || groupVoters || codeVoters)

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <SEO title="New contest" description="Create a secure community vote." path="/contests/new" />
      <h1 className="text-2xl font-bold native:hidden">New contest or election</h1>

      {!isAdmin ? (
        <p className="flex gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-[14px] text-sky-800 dark:text-sky-200">
          <Info className="mt-0.5 size-4 shrink-0" /> An admin will review your contest before it goes live.
        </p>
      ) : null}

      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-[14px] font-semibold">
          <LayoutTemplate className="size-4" /> Start from a template
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTEST_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className={cn(
                'rounded-xl border p-3 text-left',
                template === t.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card hover:bg-muted/50',
              )}
            >
              <span className="block text-[14px] font-semibold">{t.name}</span>
              <span className="block text-[12px] text-muted-foreground">{t.hint}</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">Or fill in the form yourself. You can change anything a template fills in.</p>
      </section>

      <Field label="Title" hint="e.g. Bende Union Executive Election 2026, Best Aba Business Award">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="h-12" aria-label="Title" />
      </Field>

      <Field label="Description" hint="What is being decided, and any rules for candidates or voters.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} aria-label="Description" />
      </Field>

      <Field label="Group">
        <select
          value={subgroupId}
          onChange={(e) => setSubgroupId(e.target.value)}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-[15px]"
          aria-label="Group"
        >
          {isAdmin ? <option value="">Whole community (voter codes)</option> : <option value="" disabled>Choose your group</option>}
          {(groups.data ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Who can vote" hint="Every person can vote only once, whichever way they qualify.">
        <div className="space-y-2">
          <Choice
            checked={!noGroup && groupVoters}
            disabled={noGroup}
            onChange={setGroupVoters}
            title="Members of the group"
            text={noGroup ? 'Pick a group above to use this.' : 'Members vote in the app.'}
          />
          <Choice
            checked={codeVoters || noGroup}
            disabled={noGroup}
            onChange={setCodeVoters}
            title="People with a voter code"
            text="You get one-time codes to print or hand out, like ballot papers. Good for members at a meeting or outside the app group."
          />
        </div>
      </Field>

      <Field label="Keeping the vote fair">
        <div className="space-y-2">
          <Choice
            checked={!noGroup && groupVoters && membersBefore}
            disabled={noGroup || !groupVoters}
            onChange={setMembersBefore}
            title="Only people who are members now"
            text="People who join the group after you create this contest can’t vote. Stops anyone bringing in outsiders at the last minute. Recommended."
          />
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <span>
              <span className="block text-[14px] font-semibold">Minimum account age</span>
              <span className="block text-[12px] text-muted-foreground">Brand-new accounts can’t vote through the group. Voter codes still work.</span>
            </span>
            <select
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="h-10 rounded-md border border-input bg-background px-2 text-[14px]"
              aria-label="Minimum account age"
            >
              <option value={0}>Any age</option>
              <option value={7}>1 week</option>
              <option value={30}>1 month</option>
              <option value={90}>3 months</option>
            </select>
          </label>
          <Choice
            checked={isPublic}
            onChange={setIsPublic}
            title="Anyone with the link can follow"
            text="People outside the group, at home or abroad, can watch the turnout and results. Only those allowed can vote."
          />
        </div>
      </Field>

      <Field label="Results">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['after_close', 'After voting closes', 'Best for elections'],
              ['live', 'Live totals', 'More exciting for awards'],
            ] as const
          ).map(([id, t, s]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVisibility(id)}
              className={cn(
                'rounded-xl border p-3 text-left',
                visibility === id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card',
              )}
            >
              <span className="block text-[14px] font-semibold">{t}</span>
              <span className="block text-[12px] text-muted-foreground">{s}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Voting opens">
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-12" aria-label="Voting opens" />
        </Field>
        <Field label="Voting closes">
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-12" aria-label="Voting closes" />
        </Field>
      </div>

      <Field
        label={positions.length > 1 ? `Positions (${positions.length})` : 'Candidates'}
        hint="Add a position for each office being voted for (e.g. Chairman, Secretary). Voters fill in one ballot for all of them."
      >
        <div className="space-y-3">
          {positions.map((p, i) => (
            <div key={i} className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={p.title}
                  onChange={(e) => updatePos(i, { title: e.target.value })}
                  placeholder="Position, e.g. Chairman"
                  aria-label={`Position ${i + 1} name`}
                  maxLength={120}
                  className="h-11 font-semibold"
                />
                {positions.length > 1 ? (
                  <>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => movePos(i, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Move down"
                      disabled={i === positions.length - 1}
                      onClick={() => movePos(i, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove position ${p.title || i + 1}`}
                      onClick={() => setPositions((list) => list.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                Each voter picks up to
                <select
                  value={p.max_choices}
                  onChange={(e) => updatePos(i, { max_choices: Number(e.target.value) })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-[14px] text-foreground"
                  aria-label={`How many each voter picks for ${p.title || 'this position'}`}
                >
                  {Array.from({ length: Math.max(1, Math.min(10, p.candidates.length)) }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {p.max_choices === 1 ? 'person' : 'people'}
              </label>
              {p.candidates.map((c, k) => (
                <div key={k} className="rounded-xl border border-border/70 p-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={c.name}
                      onChange={(e) => updateCand(i, k, { name: e.target.value })}
                      placeholder={`Candidate ${k + 1} name`}
                      aria-label={`${p.title || 'Position'} candidate ${k + 1} name`}
                      maxLength={120}
                      className="h-11"
                    />
                    {p.candidates.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove candidate ${k + 1}`}
                        onClick={() => updatePos(i, { candidates: p.candidates.filter((_, j) => j !== k) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    value={c.bio}
                    onChange={(e) => updateCand(i, k, { bio: e.target.value })}
                    placeholder="Short description (optional)"
                    maxLength={600}
                    className="mt-2 h-10"
                  />
                </div>
              ))}
              {p.candidates.length < 30 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full rounded-xl"
                  onClick={() => updatePos(i, { candidates: [...p.candidates, { name: '', bio: '' }] })}
                >
                  <Plus className="size-4" /> Add candidate
                </Button>
              ) : null}
            </div>
          ))}
          {positions.length < 15 ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-dashed"
              onClick={() => setPositions((list) => [...list, { title: '', max_choices: 1, candidates: blankCands() }])}
            >
              <Plus className="size-4" /> Add another position
            </Button>
          ) : null}
        </div>
      </Field>

      <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Secret ballot: nobody, including you and our admins, can see who anyone voted for.
      </p>
      <Button className="h-12 w-full rounded-xl text-[15px] font-bold" disabled={!valid || create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? 'Saving…' : isAdmin ? 'Publish contest' : 'Send for approval'}
      </Button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[14px] font-semibold text-foreground">{label}</p>
      {children}
      {hint ? <p className="text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Choice({
  checked,
  disabled,
  onChange,
  title,
  text,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  title: string
  text: string
}) {
  return (
    <label className={cn('flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-3', disabled && 'cursor-default opacity-70')}>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="block text-[12px] text-muted-foreground">{text}</span>
      </span>
    </label>
  )
}
