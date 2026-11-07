import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, PenLine } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { getOpportunities, type BoardKind } from '@/lib/community'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ReasonBadge } from '@/components/connect/ReasonBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const KINDS: Array<{ id: BoardKind | null; label: string }> = [
  { id: null, label: 'All' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'work', label: 'Looking for work' },
  { id: 'services', label: 'Services' },
  { id: 'networking', label: 'Business' },
]

const LGAS = [
  'Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato',
  'Obi Ngwa', 'Ohafia', 'Osisioma Ngwa', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umunneochi',
]

/** Who is hiring and who offers what, built from members' Connect profiles. */
export default function Opportunities() {
  const [kind, setKind] = useState<BoardKind | null>(null)
  const [lga, setLga] = useState('')
  const boardQ = useQuery({
    queryKey: ['opportunities', kind, lga],
    queryFn: () => getOpportunities(kind, lga || null),
    staleTime: 60_000,
  })
  const members = boardQ.data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SEO title="Jobs and services" description="Find who is hiring and who offers what across Abia State." path="/opportunities" />
      <div className="native:hidden">
        <h1 className="text-2xl font-bold">Jobs and services</h1>
        <p className="text-sm text-muted-foreground">Who is hiring, who offers what, in which LGA.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {KINDS.map((k) => (
          <button
            key={k.label}
            type="button"
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold',
              kind === k.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <label className="block text-sm font-semibold">
        <span className="sr-only">Choose an LGA</span>
        <select value={lga} onChange={(e) => setLga(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm">
          <option value="">All LGAs</option>
          {LGAS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      {boardQ.isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : boardQ.isError ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This list isn’t available right now. Please try again shortly.
        </p>
      ) : !members.length ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nobody is listed here yet. Be the first.
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const name = m.display_name || m.username || 'Member'
            return (
              <li key={m.user_id}>
                <Link to={`/member/${m.user_id}`} className="flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40">
                  <UserAvatar avatarUrl={m.avatar_url} displayName={name} size="lg" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{name}</p>
                    <ReasonBadge reason={m.looking_for} className="mt-1" />
                    {m.headline ? <p className="mt-1.5 line-clamp-2 text-sm font-semibold">{m.headline}</p> : null}
                    {m.services || m.work_experience ? (
                      <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{m.services || m.work_experience}</p>
                    ) : null}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      {m.business_name || m.occupation ? (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="size-3" /> {m.business_name || m.occupation}
                        </span>
                      ) : null}
                      {m.lga ? <span>{m.lga}</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Button asChild variant="outline" className="w-full rounded-full">
        <Link to="/relationship/edit">
          <PenLine className="size-4" /> List yourself here
        </Link>
      </Button>
    </div>
  )
}
