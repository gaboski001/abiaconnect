import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { BadgeCheck, Bookmark, MessageCircle, Pin, Share2, ThumbsUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { toggleFollow } from '@/lib/connect'
import { threadShareLink } from '@/lib/shareLinks'
import { shownCount } from '@/lib/quietNumbers'
import type { FeedPost, MemberLabel } from '@/lib/community'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils'
import { FollowConfirm } from './FollowConfirm'

const sb = supabase as any

/** Level and trusted mark beside a member's name. */
export function MemberMarks({ label, className }: { label?: MemberLabel; className?: string }) {
  if (!label) return null
  return (
    <>
      {label.trusted ? (
        <span title="Trusted member" className={cn('inline-flex shrink-0 items-center text-sky-600 dark:text-sky-400', className)}>
          <BadgeCheck className="size-4" aria-label="Trusted member" />
        </span>
      ) : null}
      {label.level > 1 ? (
        <span className={cn('shrink-0 rounded-full bg-amber-400/20 px-2 text-[11px] font-bold leading-5 text-amber-800 dark:text-amber-300', className)}>
          Level {label.level}
        </span>
      ) : null}
    </>
  )
}

export function FollowMemberButton({
  memberId,
  following,
  className,
}: {
  memberId: string
  following: boolean
  className?: string
}) {
  const qc = useQueryClient()
  const [asking, setAsking] = useState(false)
  const follow = useMutation({
    mutationFn: () => toggleFollow(memberId),
    onSuccess: (r) => {
      if (r.status !== 'ok') toast.error('You can’t follow this member right now.')
      qc.invalidateQueries({ queryKey: ['my-following-ids'] })
      qc.invalidateQueries({ queryKey: ['member-summary'] })
      qc.invalidateQueries({ queryKey: ['follow-list'] })
    },
    onError: () => toast.error('That didn’t work. Please try again.'),
  })
  return (
    <>
      <button
        type="button"
        onClick={() => (following ? setAsking(true) : follow.mutate())}
        disabled={follow.isPending}
        className={cn(
          'shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors disabled:opacity-60',
          following ? 'border-border text-muted-foreground' : 'border-primary/40 text-primary hover:bg-primary/10',
          className,
        )}
      >
        {following ? 'Following' : 'Follow'}
      </button>
      <FollowConfirm
        open={asking}
        title="Unfollow this member?"
        description="Their posts will stop showing in your Following feed. You can follow them again any time."
        confirmLabel="Unfollow"
        onConfirm={() => follow.mutate()}
        onClose={() => setAsking(false)}
      />
    </>
  )
}

/**
 * One post in a feed. The person comes first, then what they wrote, then the
 * things you can do with it. Anonymous posts show no picture, link or Follow.
 */
export function PostCard({
  post,
  label,
  userId,
  following,
  myVote,
  onVoted,
}: {
  post: FeedPost
  label?: MemberLabel
  userId: string | null
  following: boolean
  /** The member's own vote on this post, if any. */
  myVote?: { id: string; value: number }
  onVoted?: () => void
}) {
  const name = post.is_anonymous ? 'Anonymous member' : post.author?.display_name || post.author?.username || 'Member'
  const [likes, setLikes] = useState(post.upvotes)
  const [vote, setVote] = useState(myVote)
  // The member's own votes load just after the feed.
  const [seenVote, setSeenVote] = useState(myVote)
  if (myVote !== seenVote) {
    setSeenVote(myVote)
    setVote(myVote)
  }
  const liked = vote?.value === 1

  const like = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to like this post')
      if (vote?.value === 1) {
        const { error } = await sb.from('thread_votes').delete().eq('id', vote.id)
        if (error) throw error
        return undefined
      }
      if (vote) {
        const { error } = await sb.from('thread_votes').update({ value: 1 }).eq('id', vote.id)
        if (error) throw error
        return { id: vote.id, value: 1 }
      }
      const { data, error } = await sb
        .from('thread_votes')
        .insert({ thread_id: post.id, user_id: userId, value: 1 })
        .select('id')
        .single()
      if (error) throw error
      return { id: data.id as string, value: 1 }
    },
    onSuccess: (next) => {
      setLikes((n) => Math.max(0, n + (next ? 1 : -1)))
      setVote(next)
      onVoted?.()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That didn’t work. Please try again.'),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to save this post')
      const { error } = await supabase.from('bookmarks').insert({ thread_id: post.id, user_id: userId })
      if (error && error.code !== '23505') throw error
    },
    onSuccess: () => toast.success('Saved to your posts'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That didn’t work. Please try again.'),
  })

  const share = async () => {
    const url = await threadShareLink(post.id).catch(() => `https://abiaconnect.com/thread/${post.id}`)
    try {
      if (navigator.share) await navigator.share({ title: post.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      // The member closed the share sheet.
    }
  }

  const where = post.group ? `👥 ${post.group.name}` : post.category ? `${post.category.icon ?? '💬'} ${post.category.name}` : null
  const memberHref = post.author_id ? `/member/${post.author_id}` : null
  const action = 'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60'

  return (
    <article className="bg-card">
      <div className="flex items-start gap-3 px-4 pt-4">
        {memberHref ? (
          <Link to={memberHref} aria-label={name} className="shrink-0">
            <UserAvatar avatarUrl={post.author?.avatar_url} displayName={name} size="md" className="size-11" />
          </Link>
        ) : (
          <UserAvatar avatarUrl={null} displayName={name} size="md" className="size-11" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {memberHref ? (
              <Link to={memberHref} className="truncate text-[15px] font-bold text-foreground hover:underline">
                {name}
              </Link>
            ) : (
              <span className="truncate text-[15px] font-bold text-foreground">{name}</span>
            )}
            <MemberMarks label={label} />
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {[post.author?.lga, formatDistanceToNow(new Date(post.created_at), { addSuffix: true })].filter(Boolean).join(' · ')}
          </p>
        </div>
        {userId && post.author_id && post.author_id !== userId ? (
          <FollowMemberButton memberId={post.author_id} following={following} />
        ) : null}
      </div>

      <Link to={`/thread/${post.id}`} className="block">
        <div className="px-4 pt-3">
          <h3 className="flex items-start gap-1.5 text-[16px] font-bold leading-snug text-foreground">
            {post.is_pinned ? <Pin className="mt-1 size-3.5 shrink-0 text-amber-500" aria-label="Pinned" /> : null}
            <span className="line-clamp-3">{post.title}</span>
          </h3>
          {post.excerpt ? <p className="mt-1 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
        </div>
        {post.image ? (
          <img src={post.image} alt="" loading="lazy" className="mt-3 max-h-[420px] w-full bg-muted object-cover" />
        ) : null}
      </Link>

      <div className="flex items-center gap-3 px-4 pt-3 text-[12.5px] text-muted-foreground">
        {where ? <span className="min-w-0 truncate rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">{where}</span> : null}
        <span className="ml-auto shrink-0">
          {shownCount(likes) ? `${likes} ${likes === 1 ? 'like' : 'likes'}` : null}
          {shownCount(likes) && post.reply_count ? ' · ' : null}
          {post.reply_count ? `${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}` : null}
        </span>
      </div>

      <div className="mx-2 mt-2 flex border-t border-border py-1">
        <button type="button" className={cn(action, liked && 'text-primary')} onClick={() => like.mutate()} disabled={like.isPending} aria-pressed={liked}>
          <ThumbsUp className="size-[18px]" fill={liked ? 'currentColor' : 'none'} /> Like
        </button>
        <Link to={`/thread/${post.id}`} className={cn(action, !post.reply_count && 'text-primary')}>
          <MessageCircle className="size-[18px]" /> {post.reply_count ? 'Reply' : 'Reply first'}
        </Link>
        <button type="button" className={action} onClick={() => save.mutate()} disabled={save.isPending}>
          <Bookmark className="size-[18px]" /> Save
        </button>
        <button type="button" className={action} onClick={share}>
          <Share2 className="size-[18px]" /> Share
        </button>
      </div>
    </article>
  )
}
