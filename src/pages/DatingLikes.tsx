import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Crown, Heart, Lock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { SEO } from '@/components/SEO'
import { PaywallDialog } from '@/components/dating/PaywallDialog'
import { MatchDialog, type MatchPartner } from '@/components/dating/MatchDialog'
import { useStartDatingChat } from '@/hooks/useStartDatingChat'
import { useAuth } from '@/contexts/AuthContext'
import { calcAge } from '@/lib/relationship'
import {
  getLikesReceived,
  getMatches,
  markLikesSeen,
  reactToProfile,
  track,
  type LikeItem,
  type MatchItem,
} from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'
import { toast } from '@/lib/toast'

const PAGE = 20

export default function DatingLikes() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'matches' ? 'matches' : 'likes'

  return (
    <div className="mx-auto max-w-3xl">
      <SEO title="Requests & connections" description="See who wants to connect with you and your connections." path="/relationship/likes" />
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to Relationship">
          <Link to="/relationship">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t('likes.title')}</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams(v === 'matches' ? { tab: 'matches' } : {}, { replace: true })}>
        <TabsList className="mb-4 grid w-full grid-cols-2 rounded-full">
          <TabsTrigger value="likes" className="rounded-full">
            {t('likes.tab_likes')}
          </TabsTrigger>
          <TabsTrigger value="matches" className="rounded-full">
            {t('likes.tab_matches')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="likes">
          <LikesYou />
        </TabsContent>
        <TabsContent value="matches">
          <Matches />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LikesYou() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [unseenOnly, setUnseenOnly] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [match, setMatch] = useState<MatchPartner | null>(null)
  const [liking, setLiking] = useState<string | null>(null)

  const q = useInfiniteQuery({
    queryKey: ['dating-likes', user?.id, unseenOnly],
    queryFn: ({ pageParam }) => getLikesReceived(PAGE, pageParam, unseenOnly),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.entitled && last.items.length === PAGE ? pages.length * PAGE : undefined,
    enabled: !!user,
  })

  const first = q.data?.pages[0]
  const items = q.data?.pages.flatMap((p) => p.items) ?? []

  useEffect(() => {
    track('LIKES_YOU_VIEWED', { entitled: !!first?.entitled })
    // Premium users have now seen their likes.
    if (first?.entitled && first.unseen > 0) {
      markLikesSeen().then(() => queryClient.invalidateQueries({ queryKey: ['dating-likes-count'] }), () => undefined)
    }
  }, [first?.entitled, first?.unseen, queryClient])

  const likeBack = async (item: LikeItem) => {
    setLiking(item.user_id)
    try {
      const r = await reactToProfile(item.user_id, 'like')
      if (r.status === 'limit_reached') setPaywall(true)
      else if (r.status !== 'ok') toast.error(t('discover.unavailable'))
      else {
        if (r.matched) setMatch({ userId: item.user_id, name: item.display_name || item.username || 'them' })
        queryClient.invalidateQueries({ queryKey: ['dating-likes'] })
        queryClient.invalidateQueries({ queryKey: ['dating-likes-count'] })
        queryClient.invalidateQueries({ queryKey: ['dating-matches'] })
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLiking(null)
    }
  }

  if (q.isLoading) return <GridSkeleton />
  if (q.isError) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load likes. Please try again.</p>
  if (!first || first.total === 0) return <Empty icon={<Heart className="size-6 text-pink-600" />} text={t('likes.empty')} />

  // Free plan: counts and an anonymous preview only.
  if (!first.entitled) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <p className="text-lg font-semibold">
          {first.total === 1 ? t('likes.count_one') : t('likes.count', { count: first.total })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t('likes.locked')}</p>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-3" aria-hidden>
          {Array.from({ length: Math.max(first.preview_count, Math.min(first.total, 3)) }).map((_, i) => (
            <div
              key={i}
              className="grid aspect-[3/4] place-items-center rounded-2xl bg-gradient-to-br from-pink-500/30 to-rose-600/30 blur-[1px]"
            >
              <Lock className="size-5 text-white/90" />
            </div>
          ))}
        </div>
        <Button
          className="mt-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white"
          onClick={() => setPaywall(true)}
        >
          <Crown className="size-4" /> {t('paywall.see_likes.cta')}
        </Button>
        <PaywallDialog reason="see_likes" open={paywall} onOpenChange={setPaywall} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {first.total === 1 ? t('likes.count_one') : t('likes.count', { count: first.total })}
        </p>
        <div className="flex items-center gap-2">
          <Switch id="unseen-only" checked={unseenOnly} onCheckedChange={setUnseenOnly} />
          <Label htmlFor="unseen-only" className="text-sm">
            New only
          </Label>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.user_id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Link to={`/relationship/${item.user_id}`} className="block p-4 text-center">
              <div className="relative mx-auto w-fit">
                <UserAvatar avatarUrl={item.avatar_url} displayName={item.display_name || item.username} size="xl" />
                {item.unseen && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-pink-600 px-1.5 text-[10px] font-bold leading-5 text-white">
                    {t('likes.new')}
                  </span>
                )}
              </div>
              <p className="mt-2 truncate font-semibold">
                {item.display_name || item.username || 'Member'}
                {calcAge(item.dob) ? `, ${calcAge(item.dob)}` : ''}
              </p>
              {item.lga && <p className="truncate text-xs text-muted-foreground">{item.lga}</p>}
            </Link>
            <div className="px-3 pb-3">
              <Button
                size="sm"
                className="w-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-white"
                onClick={() => likeBack(item)}
                disabled={liking === item.user_id}
              >
                <Heart className="size-4" fill="white" /> {t('likes.like_back')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <Button variant="outline" className="rounded-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            Load more
          </Button>
        </div>
      )}
      <PaywallDialog reason="likes_limit" open={paywall} onOpenChange={setPaywall} />
      <MatchDialog partner={match} onClose={() => setMatch(null)} />
    </div>
  )
}

function Matches() {
  const { user } = useAuth()
  const chat = useStartDatingChat()
  const q = useQuery({ queryKey: ['dating-matches', user?.id], queryFn: () => getMatches(), enabled: !!user })
  const message = (m: MatchItem) => chat.start(m.user_id)
  const opening = chat.busyWith

  if (q.isLoading) return <GridSkeleton />
  if (q.isError) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load matches. Please try again.</p>
  if (!q.data?.length) return <Empty icon={<Heart className="size-6 text-pink-600" />} text={t('likes.matches_empty')} />

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {q.data.map((m) => (
        <li key={m.user_id} className="flex items-center gap-3 p-3">
          <Link to={`/relationship/${m.user_id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar avatarUrl={m.avatar_url} displayName={m.display_name || m.username} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {m.display_name || m.username || 'Member'}
                {calcAge(m.dob) ? `, ${calcAge(m.dob)}` : ''}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.headline || m.lga || ''}</p>
            </div>
          </Link>
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => message(m)} disabled={opening === m.user_id}>
            <MessageCircle className="size-4" /> {t('likes.message')}
          </Button>
        </li>
      ))}
    </ul>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-pink-500/10">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-2xl" />
      ))}
    </div>
  )
}
