import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SEO } from '@/components/SEO'
import { FollowList } from '@/components/community/FollowList'
import { useAuth } from '@/contexts/AuthContext'
import { getConnectSummary } from '@/lib/connect'
import type { FollowKind } from '@/lib/follows'
import { supabase } from '@/lib/supabase'

const TABS: FollowKind[] = ['followers', 'following']

/** A member's Followers and Following, like Instagram. */
export default function MemberFollows() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab: FollowKind = params.get('tab') === 'following' ? 'following' : 'followers'
  const mine = user?.id === userId

  const nameQ = useQuery({
    queryKey: ['member-name', userId],
    enabled: !!userId && !mine,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_public_profiles', { _ids: [userId as string] })
      const p = (Array.isArray(data) ? data[0] : data) as { display_name?: string | null; username?: string | null } | null
      return p?.display_name || p?.username || 'Member'
    },
  })
  const summaryQ = useQuery({ queryKey: ['member-summary', userId], enabled: !!userId, queryFn: () => getConnectSummary(userId!).catch(() => null) })
  const title = mine ? 'Your followers' : nameQ.data ?? 'Member'

  if (!userId) return null
  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">Sign in to see followers</h1>
        <Button asChild className="mt-4 rounded-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  const count = (k: FollowKind) => summaryQ.data?.[k]
  return (
    <div className="mx-auto max-w-2xl">
      <SEO title={`${title} · Followers`} description="Followers and following on AbiaConnect." path={`/member/${userId}/follows`} />
      <div className="mb-4 flex items-center gap-2 native:hidden">
        <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to the member page">
          <Link to={`/member/${userId}`}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="truncate text-xl font-bold">{title}</h1>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4 grid w-full grid-cols-2 rounded-full">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k} className="rounded-full">
              {count(k) != null ? `${count(k)} ` : ''}
              {k === 'followers' ? 'Followers' : 'Following'}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((k) => (
          <TabsContent key={k} value={k}>
            <FollowList userId={userId} kind={k} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
