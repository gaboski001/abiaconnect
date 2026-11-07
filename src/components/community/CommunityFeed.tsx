import { Fragment, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useJourney } from '@/lib/journey'
import { useNewsdeskAuthor } from '@/lib/feed'
import { FEED_TAB_LABELS, loadFeed, useFollowingIds, useMemberLabels, type FeedTab } from '@/lib/community'
import { NewDiscussionsBanner } from '@/components/engagement/LiveCommunity'
import { PostCard } from '@/components/community/PostCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PAGE = 10

/**
 * The forum's posts with their tabs, used by the home pages and the dashboard.
 * `between` slots other cards in after a given post, as a social feed does. It
 * is also called once with -1 when there are no posts, so nothing goes missing.
 */
export function CommunityFeed({
  pageSize = PAGE,
  between,
  moreLink,
  className,
}: {
  pageSize?: number
  between?: (postIndex: number, total: number) => ReactNode
  /** Show a link to the full forum instead of a "Show more" button. */
  moreLink?: { to: string; label: string }
  className?: string
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const journey = useJourney()
  const newsdesk = useNewsdeskAuthor()
  const following = useFollowingIds(user?.id)
  const [params] = useSearchParams()
  const lgaGroup = journey.data?.lga_group ?? null

  const tabs: FeedTab[] = [
    'community',
    ...(lgaGroup ? (['my-lga'] as const) : []),
    ...(user ? (['following'] as const) : []),
    'news',
    'popular',
    'unanswered',
  ]
  const asked = params.get('feed') as FeedTab | null
  const [tab, setTab] = useState<FeedTab>(asked && tabs.includes(asked) ? asked : 'community')
  const [limit, setLimit] = useState(pageSize)
  const followingIds = following.data ?? []

  const feed = useQuery({
    queryKey: ['community-feed', tab, lgaGroup, newsdesk.data ?? null, limit, tab === 'following' ? followingIds : null],
    enabled: newsdesk.isFetched && (tab !== 'following' || following.isFetched),
    staleTime: 30_000,
    queryFn: () => loadFeed({ tab, lgaGroup, newsdesk: newsdesk.data ?? null, followingIds, limit }),
  })
  const posts = feed.data ?? []
  const labels = useMemberLabels(posts.map((p) => p.author_id))

  const postIds = posts.map((p) => p.id)
  const votes = useQuery({
    queryKey: ['my-feed-votes', user?.id, postIds],
    enabled: !!user && postIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('thread_votes')
        .select('id, thread_id, value')
        .eq('user_id', user!.id)
        .in('thread_id', postIds)
      if (error) return {}
      const out: Record<string, { id: string; value: number }> = {}
      for (const v of (data ?? []) as Array<{ id: string; thread_id: string; value: number }>) out[v.thread_id] = v
      return out
    },
  })

  const emptyText =
    tab === 'unanswered'
      ? 'Every recent discussion has a reply. 🎉'
      : tab === 'following'
        ? followingIds.length
          ? 'The people you follow haven’t posted lately.'
          : 'Follow people to see their posts here. Tap Follow on any post.'
        : tab === 'my-lga'
          ? 'Your LGA group is quiet so far.'
          : tab === 'community'
            ? 'No posts from members yet. Start the first conversation!'
            : 'No discussions yet.'

  return (
    <section className={className}>
      <div
        className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 [scrollbar-width:none]"
        role="tablist"
        aria-label="Sort discussions"
      >
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t)
              setLimit(pageSize)
            }}
            className={cn(
              // The tabs are wider than a small phone: they scroll instead of widening the page.
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {FEED_TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <NewDiscussionsBanner queryKeys={[['community-feed']]} />

      {feed.isPending ? (
        <div className="space-y-2 bg-muted/30 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse bg-card" />
          ))}
        </div>
      ) : feed.isError ? (
        <div className="bg-card p-6 text-center text-sm text-muted-foreground">
          Couldn’t load discussions.{' '}
          <button type="button" className="font-semibold text-primary" onClick={() => feed.refetch()}>
            Try again
          </button>
        </div>
      ) : !posts.length ? (
        <p className="bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyText}
          {tab === 'my-lga' && lgaGroup ? (
            <>
              {' '}
              <Link to={`/subgroups/${lgaGroup}`} className="font-semibold text-primary hover:underline">
                Be the first to start a conversation
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <div className="space-y-2 bg-muted/40 pt-2">
          {posts.map((post, i) => (
            <Fragment key={post.id}>
              <PostCard
                post={post}
                label={post.author_id ? labels[post.author_id] : undefined}
                userId={user?.id ?? null}
                following={!!post.author_id && followingIds.includes(post.author_id)}
                myVote={votes.data?.[post.id]}
                onVoted={() => qc.invalidateQueries({ queryKey: ['my-feed-votes', user?.id] })}
              />
              {between?.(i, posts.length)}
            </Fragment>
          ))}
        </div>
      )}

      {!feed.isPending && !posts.length ? between?.(-1, 0) : null}

      {moreLink ? (
        <Link to={moreLink.to} className="block border-t border-border bg-card py-3 text-center text-sm font-bold text-primary hover:bg-muted/40">
          {moreLink.label} →
        </Link>
      ) : posts.length >= limit ? (
        <div className="bg-card p-3 text-center">
          <Button variant="outline" className="rounded-full" onClick={() => setLimit((n) => n + pageSize)} disabled={feed.isFetching}>
            {feed.isFetching ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
