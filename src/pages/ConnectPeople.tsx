import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { SEO } from '@/components/SEO'
import { ReasonBadge } from '@/components/connect/ReasonBadge'
import { FollowList } from '@/components/community/FollowList'
import { useAuth } from '@/contexts/AuthContext'
import { getMyPeople, type PeopleKind } from '@/lib/connect'
import { isValidHttpUrl } from '@/lib/images'

const TABS: { id: PeopleKind; label: string; empty: string }[] = [
  { id: 'followers', label: 'Followers', empty: 'Nobody follows you yet. Share a post to get noticed.' },
  { id: 'following', label: 'Following', empty: 'You are not following anyone yet.' },
  { id: 'photo_likes', label: 'Photo likes', empty: 'Nobody has liked your photos yet.' },
]

function People({ kind, empty }: { kind: PeopleKind; empty: string }) {
  const { user } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['connect-people', user?.id, kind],
    enabled: !!user,
    queryFn: () => getMyPeople(kind),
  })

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />
  if (error) return <p className="py-10 text-center text-sm text-muted-foreground">This list isn&apos;t available right now. Please try again shortly.</p>
  if (!data?.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>

  return (
    <ul className="space-y-2">
      {data.map((person) => {
        const name = person.display_name || person.username || 'Member'
        return (
          <li key={`${person.user_id}-${person.photo_url ?? ''}`}>
            <Link
              to={`/member/${person.user_id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <UserAvatar avatarUrl={person.avatar_url} displayName={name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{name}</p>
                {person.headline && <p className="truncate text-xs text-muted-foreground">{person.headline}</p>}
                <ReasonBadge reason={person.looking_for} className="mt-1" />
              </div>
              {isValidHttpUrl(person.photo_url) && (
                <img src={person.photo_url as string} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** The member's own followers, who they follow, and who liked their photos. */
export default function ConnectPeople() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'followers'

  return (
    <div className="mx-auto max-w-2xl">
      <SEO title="Your people" description="See who follows you and who liked your photos." path="/relationship/people" />
      <div className="mb-4 flex items-center gap-2 native:hidden">
        <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to my profile">
          <Link to={user ? `/member/${user.id}` : '/relationship'}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Your people</h1>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4 grid w-full grid-cols-3 rounded-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="rounded-full">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            {user && t.id !== 'photo_likes' ? <FollowList userId={user.id} kind={t.id} /> : <People kind={t.id} empty={t.empty} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
