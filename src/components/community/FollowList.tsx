import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { toggleFollow } from '@/lib/connect'
import { FOLLOW_PAGE, getFollowList, removeFollower, type FollowKind, type FollowPerson } from '@/lib/follows'
import { toast } from '@/lib/toast'
import { FollowConfirm } from './FollowConfirm'

type Ask = { kind: 'unfollow' | 'remove'; person: FollowPerson } | null

/**
 * A member's Followers or Following, like Instagram: search, Follow / Follow
 * back / Following (tap to unfollow), and on your own Followers, Remove.
 */
export function FollowList({ userId, kind }: { userId: string; kind: FollowKind }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [ask, setAsk] = useState<Ask>(null)
  const mine = user?.id === userId

  useEffect(() => {
    const t = window.setTimeout(() => setQ(text), 300)
    return () => window.clearTimeout(t)
  }, [text])

  const list = useInfiniteQuery({
    queryKey: ['follow-list', userId, kind, q],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getFollowList(userId, kind, q, pageParam),
    getNextPageParam: (last, pages) => (last.length === FOLLOW_PAGE ? pages.length * FOLLOW_PAGE : undefined),
  })
  const people = list.data?.pages.flat() ?? []

  const refresh = (memberId?: string) => {
    qc.invalidateQueries({ queryKey: ['follow-list'] })
    qc.invalidateQueries({ queryKey: ['my-following-ids'] })
    qc.invalidateQueries({ queryKey: ['member-summary'] })
    if (memberId) qc.invalidateQueries({ queryKey: ['member-summary', memberId] })
  }
  const followToggle = useMutation({
    mutationFn: (p: FollowPerson) => toggleFollow(p.user_id),
    onSuccess: (r, p) => {
      if (r.status !== 'ok') toast.error('You can’t follow this member right now.')
      refresh(p.user_id)
    },
    onError: () => toast.error('That didn’t work. Please try again.'),
  })
  const remove = useMutation({
    mutationFn: (p: FollowPerson) => removeFollower(p.user_id),
    onSuccess: () => {
      toast.success('Removed from your followers')
      refresh()
    },
    onError: () => toast.error('That didn’t work. Please try again.'),
  })

  const nameOf = (p: FollowPerson) => p.display_name || p.username || 'Member'

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search" aria-label="Search people" className="rounded-full pl-9" />
      </div>

      {list.isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : list.isError ? (
        <p className="py-10 text-center text-sm text-muted-foreground">This list isn’t available right now. Please try again shortly.</p>
      ) : people.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {q
            ? 'Nobody matches that name.'
            : kind === 'followers'
              ? mine
                ? 'Nobody follows you yet. Share a post to get noticed.'
                : 'No followers yet.'
              : mine
                ? 'You are not following anyone yet.'
                : 'Not following anyone yet.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {people.map((p) => {
            const name = nameOf(p)
            const isMe = p.user_id === user?.id
            return (
              <li key={p.user_id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-muted/50">
                <Link to={`/member/${p.user_id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar avatarUrl={p.avatar_url} displayName={name} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.username ? `@${p.username}` : p.headline || ''}
                      {p.follows_me && !isMe && !(mine && kind === 'followers') ? ' · Follows you' : ''}
                    </span>
                  </span>
                </Link>
                {isMe ? null : (
                  <div className="flex shrink-0 gap-1.5">
                    {p.i_follow ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg px-3"
                        disabled={followToggle.isPending}
                        onClick={() => setAsk({ kind: 'unfollow', person: p })}
                      >
                        Following
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 rounded-lg px-3" disabled={followToggle.isPending} onClick={() => followToggle.mutate(p)}>
                        {p.follows_me ? 'Follow back' : 'Follow'}
                      </Button>
                    )}
                    {mine && kind === 'followers' ? (
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg px-2" onClick={() => setAsk({ kind: 'remove', person: p })}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {list.hasNextPage ? (
        <Button variant="ghost" className="w-full" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {list.isFetchingNextPage ? 'Loading…' : 'Show more'}
        </Button>
      ) : null}

      <FollowConfirm
        open={!!ask}
        title={ask?.kind === 'remove' ? 'Remove follower?' : `Unfollow ${ask ? nameOf(ask.person) : ''}?`}
        description={
          ask?.kind === 'remove'
            ? `${ask ? nameOf(ask.person) : ''} won’t be told they were removed. They can follow you again later.`
            : 'Their posts will stop showing in your Following feed. You can follow them again any time.'
        }
        confirmLabel={ask?.kind === 'remove' ? 'Remove' : 'Unfollow'}
        onConfirm={() => {
          if (!ask) return
          if (ask.kind === 'remove') remove.mutate(ask.person)
          else followToggle.mutate(ask.person)
        }}
        onClose={() => setAsk(null)}
      />
    </div>
  )
}
