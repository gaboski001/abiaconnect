import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { CalendarDays, Loader2, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import {
  fetchReviewQueue,
  publishSpotlight,
  removeSpotlight,
  reviewItem,
  type ReviewQueue,
} from '@/lib/communityPages'

export const REVIEW_QUEUE_KEY = ['community-review-queue']

type Decision = { kind: 'story' | 'event'; id: string; title: string; decision: 'decline' | 'remove' }

/**
 * The team's review of what members send in: success stories, events and
 * Member of the Month. Used in Moderator tools and in the admin dashboard.
 */
export function CommunityReviewPanel() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: REVIEW_QUEUE_KEY, queryFn: fetchReviewQueue, refetchInterval: 60_000 })
  const [deciding, setDeciding] = useState<Decision | null>(null)
  const [featuring, setFeaturing] = useState<{ member: string; name: string; nomination: string | null; reason?: string } | null>(null)

  const act = useMutation({
    mutationFn: (v: { kind: 'story' | 'event' | 'nomination'; id: string; decision: 'publish' | 'decline' | 'remove' | 'dismiss'; note?: string }) =>
      reviewItem(v.kind, v.id, v.decision, v.note),
    onSuccess: (_d, v) => {
      setDeciding(null)
      qc.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY })
      qc.invalidateQueries({ queryKey: ['admin-todo'] })
      toast.success(
        v.decision === 'publish'
          ? 'Published. The member has been told.'
          : v.decision === 'dismiss'
            ? 'Nomination set aside.'
            : v.decision === 'remove'
              ? 'Taken down.'
              : 'Declined. The member has been told.',
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (q.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    )
  }
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Could not load what members sent in.</p>
  const data: ReviewQueue = q.data

  const waitingStories = data.stories.filter((s) => s.status === 'pending')
  const liveStories = data.stories.filter((s) => s.status === 'published')
  const waitingEvents = data.events.filter((e) => e.status === 'pending')
  const liveEvents = data.events.filter((e) => e.status === 'published')
  const count = (n: number) => (n ? ` (${n})` : '')

  return (
    <>
      <Tabs defaultValue="stories">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="stories">Stories{count(waitingStories.length)}</TabsTrigger>
          <TabsTrigger value="events">Events{count(waitingEvents.length)}</TabsTrigger>
          <TabsTrigger value="spotlight">Member of the Month{count(data.nominations.length)}</TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="space-y-4">
          <Group title="Waiting for review" empty="No stories waiting." Icon={Sparkles}>
            {waitingStories.map((s) => (
              <Item
                key={s.id}
                title={s.title}
                meta={`${s.tag}${s.person_name ? ` · about ${s.person_name}` : ''} · sent by ${s.submitter ?? 'a member'} ${formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}`}
                body={s.story}
              >
                <Button size="sm" onClick={() => act.mutate({ kind: 'story', id: s.id, decision: 'publish' })} disabled={act.isPending}>
                  Publish
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeciding({ kind: 'story', id: s.id, title: s.title, decision: 'decline' })}>
                  Decline
                </Button>
              </Item>
            ))}
          </Group>
          <Group title="Live on the page" empty="Nothing published yet.">
            {liveStories.map((s) => (
              <Item key={s.id} title={s.title} meta={s.tag}>
                <Button size="sm" variant="ghost" onClick={() => setDeciding({ kind: 'story', id: s.id, title: s.title, decision: 'remove' })}>
                  Take down
                </Button>
              </Item>
            ))}
          </Group>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Group title="Waiting for review" empty="No events waiting." Icon={CalendarDays}>
            {waitingEvents.map((e) => (
              <Item
                key={e.id}
                title={e.title}
                meta={`${format(new Date(e.starts_at), 'EEE d MMM yyyy, h:mm a')} · ${e.place || 'Online'}${e.lga ? ` · ${e.lga}` : ''} · sent by ${e.submitter ?? 'a member'}`}
                body={`${e.description}${e.online_link ? `\n\nLink: ${e.online_link}` : ''}`}
              >
                <Button size="sm" onClick={() => act.mutate({ kind: 'event', id: e.id, decision: 'publish' })} disabled={act.isPending}>
                  Publish
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeciding({ kind: 'event', id: e.id, title: e.title, decision: 'decline' })}>
                  Decline
                </Button>
              </Item>
            ))}
          </Group>
          <Group title="Coming up on the calendar" empty="No published events coming up.">
            {liveEvents.map((e) => (
              <Item key={e.id} title={e.title} meta={format(new Date(e.starts_at), 'EEE d MMM yyyy, h:mm a')}>
                <Button size="sm" variant="ghost" onClick={() => setDeciding({ kind: 'event', id: e.id, title: e.title, decision: 'remove' })}>
                  Take down
                </Button>
              </Item>
            ))}
          </Group>
        </TabsContent>

        <TabsContent value="spotlight" className="space-y-4">
          <Group title="Nominations" empty="No nominations waiting." Icon={Star}>
            {data.nominations.map((n) => (
              <Item
                key={n.id}
                title={`${n.nominee ?? 'Member'}${n.nominee_username ? ` (@${n.nominee_username})` : ''}`}
                meta={`Nominated by ${n.nominator ?? 'a member'} ${formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}`}
                body={n.reason}
              >
                <Button size="sm" onClick={() => setFeaturing({ member: n.nominee_id, name: n.nominee ?? 'Member', nomination: n.id, reason: n.reason })}>
                  Make Member of the Month
                </Button>
                <Button size="sm" variant="outline" onClick={() => act.mutate({ kind: 'nomination', id: n.id, decision: 'dismiss' })} disabled={act.isPending}>
                  Not this time
                </Button>
              </Item>
            ))}
          </Group>
          <PickMember onPick={(m) => setFeaturing({ ...m, nomination: null })} />
          <Group title="Members of the Month" empty="Nobody featured yet.">
            {data.spotlights.map((s) => (
              <SpotlightRow key={s.id} s={s} />
            ))}
          </Group>
        </TabsContent>
      </Tabs>

      <DecisionDialog decision={deciding} onClose={() => setDeciding(null)} pending={act.isPending} onConfirm={(note) => deciding && act.mutate({ ...deciding, note })} />
      <FeatureDialog featuring={featuring} onClose={() => setFeaturing(null)} />
    </>
  )
}

function Group({ title, empty, Icon, children }: { title: string; empty: string; Icon?: typeof Star; children: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {Icon ? <Icon className="size-4 text-secondary" /> : null} {title}
      </h3>
      {children.length ? <ul className="space-y-2">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  )
}

function Item({ title, meta, body, children }: { title: string; meta: string; body?: string; children: React.ReactNode }) {
  const [full, setFull] = useState(false)
  const long = (body?.length ?? 0) > 300
  return (
    <li className="rounded-xl border p-3">
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
      {body ? (
        <>
          <p className="mt-2 whitespace-pre-line text-sm">{full || !long ? body : `${body.slice(0, 280)}…`}</p>
          {long ? (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setFull((f) => !f)}>
              {full ? 'Show less' : 'Read all'}
            </button>
          ) : null}
        </>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </li>
  )
}

function SpotlightRow({ s }: { s: ReviewQueue['spotlights'][number] }) {
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () => removeSpotlight(s.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY })
      toast.success('Removed from the page.')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Item title={`${format(new Date(s.month), 'MMMM yyyy')}: ${s.member ?? 'Member'}`} meta={s.headline}>
      <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
        Remove
      </Button>
    </Item>
  )
}

/** Choose a member directly, without a nomination. */
function PickMember({ onPick }: { onPick: (m: { member: string; name: string }) => void }) {
  const [term, setTerm] = useState('')
  const t = term.trim().replace(/^@/, '')
  const q = useQuery({
    queryKey: ['spotlight-pick', t],
    enabled: t.length >= 2,
    queryFn: async () => {
      const like = `%${t.replace(/[\\%_,()]/g, ' ')}%`
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .limit(6)
      if (error) throw error
      return data ?? []
    },
  })
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Or choose a member yourself</h3>
      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name or username" aria-label="Search members" />
      {(q.data ?? []).length ? (
        <ul className="mt-2 divide-y rounded-xl border">
          {q.data!.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <span className="min-w-0 truncate">
                {p.display_name || p.username} {p.username ? <span className="text-muted-foreground">@{p.username}</span> : null}
              </span>
              <Button size="sm" variant="outline" onClick={() => onPick({ member: p.id, name: p.display_name || p.username || 'Member' })}>
                Choose
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function DecisionDialog({
  decision,
  onClose,
  onConfirm,
  pending,
}: {
  decision: Decision | null
  onClose: () => void
  onConfirm: (note: string) => void
  pending: boolean
}) {
  const [note, setNote] = useState('')
  const remove = decision?.decision === 'remove'
  return (
    <Dialog
      open={!!decision}
      onOpenChange={(o) => {
        if (!o) {
          setNote('')
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{remove ? 'Take this down?' : 'Decline this?'}</DialogTitle>
          <DialogDescription>
            “{decision?.title}”. The member who sent it will get a notification{note.trim() ? ' with your note' : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="decision-note">A short, kind note for them (optional)</Label>
          <Textarea id="decision-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: Please add the date and the venue, then send it again." />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              onConfirm(note.trim())
              setNote('')
            }}
          >
            {remove ? 'Take down' : 'Decline'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FeatureDialog({
  featuring,
  onClose,
}: {
  featuring: { member: string; name: string; nomination: string | null; reason?: string } | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [headline, setHeadline] = useState('')
  const [about, setAbout] = useState('')
  const [quote, setQuote] = useState('')
  const reset = () => {
    setHeadline('')
    setAbout('')
    setQuote('')
  }
  const send = useMutation({
    mutationFn: () =>
      publishSpotlight({ member: featuring!.member, headline: headline.trim(), about: about.trim(), quote: quote.trim(), nomination: featuring!.nomination }),
    onSuccess: () => {
      toast.success(`${featuring?.name} is now Member of the Month. They have been told.`)
      qc.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY })
      qc.invalidateQueries({ queryKey: ['member-spotlights'] })
      reset()
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const ready = headline.trim().length >= 10 && about.trim().length >= 40

  return (
    <Dialog
      open={!!featuring}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make {featuring?.name} Member of the Month</DialogTitle>
          <DialogDescription>This replaces this month's spotlight, if there is one. Only write what is true.</DialogDescription>
        </DialogHeader>
        {featuring?.reason ? (
          <p className="rounded-lg bg-muted p-3 text-sm">
            <span className="font-medium">From the nomination:</span> {featuring.reason}
          </p>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) send.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="sp-headline">Headline</Label>
            <Input id="sp-headline" maxLength={140} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="For example: Always first to welcome newcomers" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-about">About them</Label>
            <Textarea id="sp-about" rows={5} maxLength={1500} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What they do for the community, in a few sentences" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-quote">Their words (optional)</Label>
            <Textarea id="sp-quote" rows={2} maxLength={300} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Only use words they actually said or wrote" />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || send.isPending}>
            {send.isPending ? <Loader2 className="animate-spin" /> : null} Publish spotlight
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CommunityReviewPanel
