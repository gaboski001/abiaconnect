import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { EyeOff, Flag, Loader2, RotateCcw, ShieldCheck, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SEO } from '@/components/SEO'
import { CommunityReviewPanel } from '@/components/community/CommunityReviewPanel'
import { toast } from '@/lib/toast'
import {
  fetchModActions,
  fetchModQueue,
  modDecide,
  modUndo,
  TEAM_ROLE_NAMES,
  useVolunteerPowers,
  type ModAction,
  type QueueItem,
} from '@/lib/volunteerTeam'

const QUEUE_KEY = ['mod-queue']
const ACTIONS_KEY = ['mod-actions']
const DAY = 24 * 3600_000

/** The volunteer team's tools: reported posts (moderators) and what members send in. */
export default function ModeratorTools() {
  const powers = useVolunteerPowers()
  if (powers.isLoading) {
    return (
      <p className="container flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    )
  }
  const p = powers.data
  if (!p?.moderate && !p?.review) return <Navigate to="/volunteer" replace />

  return (
    <div className="container max-w-3xl py-6">
      <SEO title="Moderator tools" description="Tools for the AbiaConnect volunteer team." path="/moderate" />
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="size-6 text-secondary" /> Moderator tools
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {p.role ? `You are on the team as ${TEAM_ROLE_NAMES[p.role]}. ` : ''}
          Thank you for keeping AbiaConnect friendly and useful. Follow the{' '}
          <Link to="/community-standards" className="font-medium text-primary hover:underline">
            Community Standards
          </Link>{' '}
          when you decide.
        </p>
      </header>

      {p.moderate ? (
        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Reported posts</TabsTrigger>
            <TabsTrigger value="community">Community pages</TabsTrigger>
          </TabsList>
          <TabsContent value="reports">
            <ReportedPosts />
          </TabsContent>
          <TabsContent value="community">
            <CommunityReviewPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <CommunityReviewPanel />
      )}
    </div>
  )
}

function ReportedPosts() {
  const qc = useQueryClient()
  const queue = useQuery({ queryKey: QUEUE_KEY, queryFn: fetchModQueue, refetchInterval: 60_000 })
  const actions = useQuery({ queryKey: ACTIONS_KEY, queryFn: () => fetchModActions(30) })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QUEUE_KEY })
    qc.invalidateQueries({ queryKey: ACTIONS_KEY })
    qc.invalidateQueries({ queryKey: ['admin-todo'] })
  }

  const undo = useMutation({
    mutationFn: modUndo,
    onSuccess: () => {
      refresh()
      toast.success('Put back. The member has been told.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const decide = useMutation({
    mutationFn: (v: { report: string; action: 'hide' | 'keep' }) => modDecide(v.report, v.action),
    onSuccess: (actionId, v) => {
      refresh()
      if (v.action === 'hide') {
        toast.success('Hidden. The member has been told why.', {
          action: { label: 'Undo', onClick: () => undo.mutate(actionId) },
        })
      } else {
        toast.success('Kept. The reports on it are closed.')
      }
    },
    onError: (e: Error) => {
      refresh()
      toast.error(e.message)
    },
  })

  // One card per post, even when several people reported it.
  const items = Object.values(
    (queue.data ?? []).reduce<Record<string, QueueItem>>((acc, it) => {
      acc[it.target_id] ??= it
      return acc
    }, {}),
  )

  return (
    <div className="space-y-6">
      <section aria-label="Reported posts">
        <p className="mb-3 text-sm text-muted-foreground">
          <strong>Hide</strong> takes a post out of view (it is not deleted, and can be put back).{' '}
          <strong>Keep</strong> means it is fine and closes the reports. The author is told when a post is hidden.
        </p>
        {queue.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading reports…
          </p>
        ) : queue.isError ? (
          <p className="text-sm text-destructive">{(queue.error as Error).message}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <ThumbsUp className="mx-auto mb-2 size-6 text-secondary" />
            <p className="font-semibold">All clear</p>
            <p className="mt-1 text-sm text-muted-foreground">No reported posts are waiting. Thank you!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.target_id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                    <Flag className="size-3" /> {it.reports_on_post > 1 ? `${it.reports_on_post} reports` : '1 report'}
                  </span>
                  <span>{it.target_type === 'reply' ? 'A reply' : 'A discussion'} by {it.author_name ?? 'a member'}</span>
                  <span>· reported {formatDistanceToNow(new Date(it.reported_at), { addSuffix: true })}</span>
                </div>
                {it.reason ? <p className="mt-2 text-sm"><span className="font-medium">Why:</span> {it.reason}</p> : null}
                {it.title ? <p className="mt-2 font-medium">{it.title}</p> : null}
                {it.excerpt ? <p className="mt-1 whitespace-pre-line rounded-lg bg-muted p-3 text-sm">{it.excerpt}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate({ report: it.report_id, action: 'hide' })}>
                    <EyeOff /> Hide
                  </Button>
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ report: it.report_id, action: 'keep' })}>
                    Keep
                  </Button>
                  {it.thread_id ? (
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/thread/${it.thread_id}`}>Open the discussion</Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionLog actions={actions.data ?? []} onUndo={(id) => undo.mutate(id)} undoing={undo.isPending} />
    </div>
  )
}

const ACTION_LABEL: Record<ModAction['action'], string> = { hide: 'Hid', keep: 'Kept', restore: 'Put back' }

/** Recent decisions, with Undo for hides (a moderator's own within a day; admins any time). */
export function ActionLog({
  actions,
  onUndo,
  undoing,
  showWho = false,
  canUndoAll = false,
}: {
  actions: ModAction[]
  onUndo: (id: string) => void
  undoing: boolean
  showWho?: boolean
  canUndoAll?: boolean
}) {
  if (!actions.length) return null
  return (
    <section aria-label="Recent decisions">
      <h2 className="mb-2 text-sm font-semibold">Recent decisions</h2>
      <ul className="divide-y rounded-2xl border">
        {actions.map((a) => {
          const canUndo = a.action === 'hide' && !a.undone_at && (canUndoAll || Date.now() - new Date(a.created_at).getTime() < DAY)
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-medium">{ACTION_LABEL[a.action]}</span> {a.target_type === 'reply' ? 'a reply' : 'a discussion'}
                  {a.excerpt ? `: “${a.excerpt}”` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {showWho ? `${a.moderator_name} · ` : ''}
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  {a.undone_at ? ' · put back later' : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {a.thread_id ? (
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/thread/${a.thread_id}`}>View</Link>
                  </Button>
                ) : null}
                {canUndo ? (
                  <Button size="sm" variant="outline" disabled={undoing} onClick={() => onUndo(a.id)}>
                    <RotateCcw /> Undo
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
