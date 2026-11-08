import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, PenSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StaticPage from '@/components/layout/StaticPage'
import { SubmissionStatus } from '@/components/community/SubmissionStatus'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { fetchStories, STORY_TAGS, submitStory, type Story, type StoryTag } from '@/lib/communityPages'

/** Real stories sent in by members and published by the team. */
export default function SuccessStories() {
  const { user } = useAuth()
  const [tag, setTag] = useState<StoryTag | 'All'>('All')
  const [open, setOpen] = useState(false)
  const q = useQuery({ queryKey: ['success-stories'], queryFn: fetchStories })
  const stories = q.data ?? []
  const tags = STORY_TAGS.filter((t) => stories.some((s) => s.tag === t))
  const shown = tag === 'All' ? stories : stories.filter((s) => s.tag === tag)

  return (
    <StaticPage
      badge="Celebrating Abians"
      title="Success Stories"
      subtitle="Real wins from Abians at home and abroad, shared by members of our community."
    >
      <p>
        Know an Abian who built a business, won a scholarship, served their community or overcame the odds? Share their
        story. Our team reads every one before it goes live.
      </p>

      <div className="not-prose my-6 flex flex-wrap items-center gap-3">
        {user ? (
          <Button onClick={() => setOpen(true)}>
            <PenSquare /> Share a success story
          </Button>
        ) : (
          <Button asChild>
            <Link to="/login">Sign in to share a story</Link>
          </Button>
        )}
      </div>

      <SubmissionStatus kind="story" />

      {tags.length > 1 ? (
        <div className="not-prose mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          {(['All', ...tags] as const).map((t) => (
            <Button key={t} size="sm" variant={tag === t ? 'default' : 'outline'} onClick={() => setTag(t)}>
              {t}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="not-prose my-4 space-y-5">
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading stories…
          </p>
        ) : q.isError ? (
          <p className="text-sm text-destructive">Could not load the stories. Please try again.</p>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Sparkles className="mx-auto mb-2 size-6 text-secondary" />
            <p className="font-semibold">No stories yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to share an Abian success story.</p>
          </div>
        ) : (
          shown.map((s) => <StoryCard key={s.id} story={s} />)
        )}
      </div>

      {user ? <StoryForm open={open} onOpenChange={setOpen} /> : null}
    </StaticPage>
  )
}

function StoryCard({ story }: { story: Story }) {
  const [full, setFull] = useState(false)
  const long = story.story.length > 420
  const text = full || !long ? story.story : `${story.story.slice(0, 400).trimEnd()}…`
  return (
    <article className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-secondary/30 bg-secondary/15 px-2 py-0.5 font-semibold uppercase tracking-wider text-secondary">
          {story.tag}
        </span>
        <span className="text-muted-foreground">{format(new Date(story.published_at), 'd MMMM yyyy')}</span>
      </div>
      <h2 className="mb-2 text-xl font-bold leading-tight text-foreground">{story.title}</h2>
      {story.person_name ? <p className="mb-2 text-sm font-medium text-muted-foreground">About {story.person_name}</p> : null}
      <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{text}</p>
      {long ? (
        <Button variant="link" className="mt-1 h-auto p-0" onClick={() => setFull((f) => !f)} aria-expanded={full}>
          {full ? 'Show less' : 'Read the full story'}
        </Button>
      ) : null}
    </article>
  )
}

function StoryForm({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [person, setPerson] = useState('')
  const [tag, setTag] = useState<StoryTag | ''>('')
  const [story, setStory] = useState('')

  const send = useMutation({
    mutationFn: () => submitStory({ title: title.trim(), story: story.trim(), tag: tag as StoryTag, person: person.trim() }),
    onSuccess: () => {
      toast.success('Thank you! Our team will read your story and let you know when it is live.')
      setTitle('')
      setPerson('')
      setTag('')
      setStory('')
      onOpenChange(false)
      qc.invalidateQueries({ queryKey: ['my-community-submissions'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const ready = title.trim().length >= 8 && story.trim().length >= 80 && !!tag

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share a success story</DialogTitle>
          <DialogDescription>Tell us what happened, in your own words. Please only share true stories.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) send.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="story-title">Headline</Label>
            <Input id="story-title" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Aba shoemaker now sells across West Africa" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="story-person">Who is it about? (optional)</Label>
            <Input id="story-person" value={person} maxLength={80} onChange={(e) => setPerson(e.target.value)} placeholder="Their name, or leave empty" />
          </div>
          <div className="space-y-1.5">
            <Label id="story-tag-label">Topic</Label>
            <Select value={tag} onValueChange={(v) => setTag(v as StoryTag)}>
              <SelectTrigger aria-labelledby="story-tag-label">
                <SelectValue placeholder="Choose a topic…" />
              </SelectTrigger>
              <SelectContent>
                {STORY_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="story-text">The story</Label>
            <Textarea id="story-text" value={story} maxLength={4000} rows={7} onChange={(e) => setStory(e.target.value)} placeholder="Where did they start, what did they do, and where are they now?" />
            <p className="text-xs text-muted-foreground">{story.trim().length < 80 ? `At least 80 characters (${story.trim().length} so far).` : `${story.length} / 4000`}</p>
          </div>
          <Button type="submit" className="w-full" disabled={!ready || send.isPending}>
            {send.isPending ? <Loader2 className="animate-spin" /> : null} Send for review
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
