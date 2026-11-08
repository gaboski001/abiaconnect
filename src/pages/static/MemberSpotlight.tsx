import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Loader2, MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ViewableAvatar } from '@/components/ui/ViewableAvatar'
import StaticPage from '@/components/layout/StaticPage'
import { SubmissionStatus } from '@/components/community/SubmissionStatus'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { fetchSpotlights, submitNomination, type Spotlight } from '@/lib/communityPages'

/** Member of the Month: real members chosen by the team, often from nominations. */
export default function MemberSpotlight() {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['member-spotlights'], queryFn: fetchSpotlights })
  const [current, ...past] = q.data ?? []

  return (
    <StaticPage
      badge="Featured"
      title="Member Spotlight"
      subtitle="Each month we celebrate a member who makes AbiaConnect better for everyone."
    >
      {q.isLoading ? (
        <p className="not-prose flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : current ? (
        <SpotlightCard s={current} />
      ) : (
        <div className="not-prose my-6 rounded-2xl border border-dashed p-8 text-center">
          <Star className="mx-auto mb-2 size-6 text-secondary" />
          <p className="font-semibold">Our first Member of the Month is coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">Know someone who helps others here? Nominate them below.</p>
        </div>
      )}

      {past.length ? (
        <>
          <h2>Past spotlights</h2>
          <div className="not-prose my-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {past.map((p) => (
              <Link key={p.id} to={`/member/${p.member_id}`} className="rounded-2xl border border-border bg-card p-5 hover:border-secondary/40">
                <p className="text-xs text-muted-foreground">{format(new Date(p.month), 'MMMM yyyy')}</p>
                <h3 className="mt-1 font-semibold text-foreground">{p.display_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.headline}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <h2>Nominate a member</h2>
      <p>
        Who answers questions, welcomes newcomers or brings people together? Tell us about them. The team reads every
        nomination.
      </p>
      <SubmissionStatus kind="nomination" />
      {user ? (
        <NominationForm />
      ) : (
        <div className="not-prose my-4">
          <Button asChild>
            <Link to="/login">Sign in to nominate a member</Link>
          </Button>
        </div>
      )}
    </StaticPage>
  )
}

function SpotlightCard({ s }: { s: Spotlight }) {
  return (
    <div className="not-prose my-6 rounded-2xl border-2 border-secondary bg-card p-6 md:p-8">
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
        <Star className="size-3.5" /> Member of the Month · {format(new Date(s.month), 'MMMM yyyy')}
      </span>
      <div className="flex items-center gap-4">
        <ViewableAvatar avatarUrl={s.avatar_url} displayName={s.display_name} size="xl" className="size-20" />
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-foreground">{s.display_name}</h3>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
            {s.lga ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {s.lga}
              </span>
            ) : null}
            {s.member_since ? <span>Member since {format(new Date(s.member_since), 'MMMM yyyy')}</span> : null}
          </p>
        </div>
      </div>
      <p className="mt-4 text-lg font-semibold text-foreground">{s.headline}</p>
      {s.quote ? (
        <blockquote className="my-4 border-l-4 border-secondary pl-4 text-lg italic text-foreground/90">“{s.quote}”</blockquote>
      ) : null}
      <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{s.about}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to={`/member/${s.member_id}`}>See {s.display_name.split(' ')[0]}'s page</Link>
      </Button>
    </div>
  )
}

function NominationForm() {
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [reason, setReason] = useState('')
  const send = useMutation({
    mutationFn: () => submitNomination({ username: username.trim(), reason: reason.trim() }),
    onSuccess: () => {
      toast.success('Thank you! The team will read your nomination.')
      setUsername('')
      setReason('')
      qc.invalidateQueries({ queryKey: ['my-community-submissions'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const ready = username.trim().length >= 2 && reason.trim().length >= 30

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) send.mutate()
      }}
      className="not-prose my-6 space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <div className="space-y-1.5">
        <Label htmlFor="nominee">Their username</Label>
        <Input id="nominee" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" autoComplete="off" />
        <p className="text-xs text-muted-foreground">You can find it on their profile, under their name.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">Why do they deserve it?</Label>
        <Textarea id="reason" value={reason} maxLength={1000} rows={4} onChange={(e) => setReason(e.target.value)} placeholder="What have they done for the community?" />
        <p className="text-xs text-muted-foreground">{reason.trim().length < 30 ? `At least 30 characters (${reason.trim().length} so far).` : `${reason.length} / 1000`}</p>
      </div>
      <Button type="submit" disabled={!ready || send.isPending}>
        {send.isPending ? <Loader2 className="animate-spin" /> : null} Send nomination
      </Button>
    </form>
  )
}
