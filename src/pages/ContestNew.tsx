import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Info, Plus, Trash2 } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { createContest, engagementErrorText } from '@/lib/engagement'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subgroupId, setSubgroupId] = useState<string>('')
  const [groupVoters, setGroupVoters] = useState(true)
  const [codeVoters, setCodeVoters] = useState(false)
  const [visibility, setVisibility] = useState<'after_close' | 'live'>('after_close')
  const [startsAt, setStartsAt] = useState(toLocalInput(now))
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(now.getTime() + 3 * 86400_000)))
  const [candidates, setCandidates] = useState([{ name: '', bio: '' }, { name: '', bio: '' }])

  // Group owners always run contests for one of their groups: preselect it.
  useEffect(() => {
    if (!isAdmin && !subgroupId && groups.data?.length) setSubgroupId(groups.data[0].id)
  }, [isAdmin, subgroupId, groups.data])

  const create = useMutation({
    mutationFn: () =>
      createContest({
        title: title.trim(),
        description: description.trim(),
        subgroupId: subgroupId || null,
        allowGroupVoters: !!subgroupId && groupVoters,
        allowCodeVoters: codeVoters || !subgroupId,
        resultsVisibility: visibility,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        candidates: candidates.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), bio: c.bio.trim() || undefined })),
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

  const filled = candidates.filter((c) => c.name.trim()).length
  const noGroup = !subgroupId
  const valid =
    title.trim().length >= 3 &&
    filled >= 2 &&
    new Date(endsAt) > new Date(startsAt) &&
    new Date(endsAt) > new Date() &&
    (isAdmin || !noGroup) &&
    (noGroup || groupVoters || codeVoters)

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <SEO title="New contest" description="Create a secure community vote." path="/contests/new" />
      <h1 className="text-2xl font-bold native:hidden">New contest</h1>

      {!isAdmin ? (
        <p className="flex gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-[14px] text-sky-800 dark:text-sky-200">
          <Info className="mt-0.5 size-4 shrink-0" /> An admin will review your contest before it goes live.
        </p>
      ) : null}

      <Field label="Title" hint="e.g. 2026 Executive Election, Best Aba Business Award">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="h-12" />
      </Field>

      <Field label="Description" hint="What is being decided, and any rules for candidates or voters.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} />
      </Field>

      <Field label="Group">
        <select
          value={subgroupId}
          onChange={(e) => setSubgroupId(e.target.value)}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-[15px]"
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
            text={noGroup ? 'Pick a group above to use this.' : 'Anyone who is a member of the group.'}
          />
          <Choice
            checked={codeVoters || noGroup}
            disabled={noGroup}
            onChange={setCodeVoters}
            title="People with a voter code"
            text="You get one-time codes to hand out, like ballot papers. Good for members outside the app group."
          />
        </div>
      </Field>

      <Field label="Results">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['after_close', 'After voting closes', 'Keeps voting fair'],
              ['live', 'Live totals', 'More exciting to watch'],
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
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-12" />
        </Field>
        <Field label="Voting closes">
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-12" />
        </Field>
      </div>

      <Field label={`Candidates (${filled})`} hint="At least 2. Add a short line about each to help voters.">
        <div className="space-y-2.5">
          {candidates.map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={c.name}
                  onChange={(e) => setCandidates((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder={`Candidate ${i + 1} name`}
                  maxLength={120}
                  className="h-11"
                />
                {candidates.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove candidate ${i + 1}`}
                    onClick={() => setCandidates((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <Input
                value={c.bio}
                onChange={(e) => setCandidates((list) => list.map((x, j) => (j === i ? { ...x, bio: e.target.value } : x)))}
                placeholder="Short description (optional)"
                maxLength={600}
                className="mt-2 h-10"
              />
            </div>
          ))}
          {candidates.length < 50 ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => setCandidates((list) => [...list, { name: '', bio: '' }])}
            >
              <Plus className="size-4" /> Add candidate
            </Button>
          ) : null}
        </div>
      </Field>

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
