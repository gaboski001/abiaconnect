import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'

import { formatDistanceToNow } from 'date-fns'
import DOMPurify from 'dompurify'
import {
  Bookmark,
  ChevronLeft,
  Eye,
  Loader2,
  Pin,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { SEO } from '@/components/SEO'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface ThreadRow {
  id: string
  title: string
  content?: string | null
  created_at: string
  user_id?: string | null
  category_id?: string | null
  upvotes?: number | null
  downvotes?: number | null
  view_count?: number | null
  is_pinned?: boolean | null
  categories?: { id: string; name: string } | null
  profiles?: {
    display_name?: string | null
    avatar_url?: string | null
    bio?: string | null
    role?: string | null
    created_at?: string | null
  } | null
}

interface Reply {
  id: string
  thread_id: string
  user_id?: string | null
  parent_reply_id?: string | null
  content: string
  created_at: string
  upvotes?: number | null
  downvotes?: number | null
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const avatarSize = size >= 10 ? 'md' : 'sm'
  return <UserAvatar avatarUrl={url} displayName={name} size={avatarSize} />
}

export default function Thread() {
  const { threadId } = useParams<{ threadId: string }>()
  const { user } = useAuth()
  const { settings } = useSiteSettings()
  const qc = useQueryClient()
  const [reply, setReply] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [nestedDraft, setNestedDraft] = useState('')
  const commentingEnabled = settings.global_commenting_enabled !== 'false'

  const threadQ = useQuery({
    queryKey: ['thread', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('id, category_id, subgroup_id, user_id, title, content, tags, allow_replies, is_anonymous, is_deleted, created_at, updated_at, is_pinned, upvotes, view_count, categories(id, name), profiles(display_name, avatar_url, bio, role, created_at)')
        .eq('id', threadId!)
        .maybeSingle()
      if (error) throw error
      return data as ThreadRow | null
    },
  })

  const REPLIES_PAGE_SIZE = 10
  type RepliesPage = { rows: Reply[]; total: number; nextPage: number | null }

  const repliesQ = useInfiniteQuery<RepliesPage>({
    queryKey: ['replies', threadId],
    enabled: !!threadId,
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
    queryFn: async ({ pageParam = 0 }) => {
      const page = pageParam as number
      const from = page * REPLIES_PAGE_SIZE
      const to = from + REPLIES_PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('replies')
        .select('*, profiles:user_id(display_name, avatar_url)', { count: 'exact' })
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      const rows = (data ?? []) as Reply[]
      const total = count ?? rows.length
      const hasMore = (page + 1) * REPLIES_PAGE_SIZE < total
      return { rows, total, nextPage: hasMore ? page + 1 : null }
    },
  })


  // Increment view count once per thread per browser session
  useEffect(() => {
    if (!threadId) return
    const key = `viewed:${threadId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    ;(async () => {
      const { data } = await supabase
        .from('threads')
        .select('view_count')
        .eq('id', threadId)
        .maybeSingle()
      const next = ((data as { view_count: number | null } | null)?.view_count ?? 0) + 1
      await supabase.from('threads').update({ view_count: next }).eq('id', threadId)
    })()
  }, [threadId])



  // Realtime subscription
  useEffect(() => {
    if (!threadId) return
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const next = payload.new as Reply
          qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
            if (!prev) return prev
            const exists = prev.pages.some((p) => p.rows.some((r) => r.id === next.id))
            if (exists) return prev
            const pages = prev.pages.map((p, i) =>
              i === prev.pages.length - 1
                ? { ...p, rows: [...p.rows, next], total: p.total + 1 }
                : { ...p, total: p.total + 1 },
            )
            return { ...prev, pages }
          })
        },

      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [threadId, qc])

  const vote = useMutation({
    mutationFn: async (value: 1 | -1) => {
      if (!user || !threadId) throw new Error('Sign in to vote')
      // Toggle: if a row with same (thread, user, value) exists, delete it; else insert.
      const { data: existing, error: selErr } = await supabase
        .from('thread_votes')
        .select('id')
        .eq('thread_id', threadId)
        .eq('user_id', user.id)
        .eq('value', value)
        .maybeSingle()
      if (selErr) throw selErr
      if (existing) {
        const { error } = await supabase
          .from('thread_votes')
          .delete()
          .eq('id', (existing as { id: string }).id)
        if (error) throw error
        return { value, removed: true as const }
      }
      const { error } = await supabase
        .from('thread_votes')
        .upsert(
          { thread_id: threadId, user_id: user.id, value },
          { onConflict: 'thread_id,user_id,value' },
        )
      if (error) throw error
      return { value, removed: false as const }
    },
    onMutate: async (value: 1 | -1) => {
      await qc.cancelQueries({ queryKey: ['thread', threadId] })
      const prev = qc.getQueryData<ThreadRow>(['thread', threadId])
      // Optimistic: we don't know yet if toggle is on/off; assume "+1" then reconcile on success.
      qc.setQueryData<ThreadRow | undefined>(['thread', threadId], (t) => {
        if (!t) return t
        const key = value === 1 ? 'upvotes' : 'downvotes'
        return { ...t, [key]: (t[key] ?? 0) + 1 }
      })
      return { prev, value }
    },
    onSuccess: (res, _v, ctx) => {
      if (res.removed) {
        // Toggle-off: roll the optimistic +1 back to -1 net.
        qc.setQueryData<ThreadRow | undefined>(['thread', threadId], (t) => {
          if (!t) return t
          const key = ctx!.value === 1 ? 'upvotes' : 'downvotes'
          return { ...t, [key]: Math.max(0, (t[key] ?? 0) - 2) }
        })
      }
      // Lightweight reconciliation: fetch authoritative counts for just this thread.
      void reconcileVotes()
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['thread', threadId], ctx.prev)
      toast.error(e instanceof Error ? e.message : 'Vote failed')
      void reconcileVotes()
    },
  })

  const reconcileVotes = async () => {
    if (!threadId) return
    const { data, error } = await supabase.rpc('get_thread_vote_counts', {
      _thread_ids: [threadId],
    })
    if (error || !data) return
    const row = (data as Array<{ thread_id: string; upvotes: number; downvotes: number }>)[0]
    qc.setQueryData<ThreadRow | undefined>(['thread', threadId], (t) =>
      t ? { ...t, upvotes: Number(row?.upvotes ?? 0), downvotes: Number(row?.downvotes ?? 0) } : t,
    )
  }

  const bookmark = useMutation({
    mutationFn: async () => {
      if (!user || !threadId) throw new Error('Sign in to bookmark')
      const { error } = await supabase
        .from('bookmarks')
        .insert({ thread_id: threadId, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => toast.success('Bookmarked!'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Bookmark failed'),
  })

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  type ReplyVars = { content: string; parentId?: string | null }

  const submitReply = useMutation({
    mutationFn: async ({ content, parentId }: ReplyVars) => {
      if (!user || !threadId) throw new Error('Sign in to reply')
      const trimmed = content.trim()
      if (trimmed.length === 0 || trimmed.length > 5000) throw new Error('Reply must be 1–5000 characters')
      const { data, error } = await supabase
        .from('replies')
        .insert({ thread_id: threadId, user_id: user.id, content: trimmed, parent_reply_id: parentId ?? null })
        .select('id, thread_id, user_id, content, created_at, parent_reply_id')
        .single()
      if (error) throw error
      const enriched: Reply = {
        ...(data as Reply),
        profiles: {
          display_name: user.user_metadata?.display_name ?? user.email ?? 'You',
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
      }
      return enriched
    },
    onMutate: async ({ content, parentId }: ReplyVars) => {
      if (!user || !threadId) return { tempId: null as string | null, prevReply: reply, parentId: parentId ?? null }
      await qc.cancelQueries({ queryKey: ['replies', threadId] })
      const tempId = `temp-${Date.now()}`
      const optimistic: Reply & { _optimistic?: boolean } = {
        id: tempId,
        thread_id: threadId,
        user_id: user.id,
        parent_reply_id: parentId ?? null,
        content: content.trim(),
        created_at: new Date().toISOString(),
        upvotes: 0,
        downvotes: 0,
        profiles: {
          display_name: user.user_metadata?.display_name ?? user.email ?? 'You',
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
        _optimistic: true,
      }
      qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
        if (!prev) return prev
        const pages = prev.pages.map((p, i) =>
          i === prev.pages.length - 1
            ? { ...p, rows: [...p.rows, optimistic], total: p.total + 1 }
            : { ...p, total: p.total + 1 },
        )
        return { ...prev, pages }
      })
      const prevReply = parentId ? nestedDraft : reply
      if (parentId) {
        setNestedDraft('')
        setReplyingTo(null)
      } else {
        setReply('')
      }
      return { tempId, prevReply, parentId: parentId ?? null }
    },
    onSuccess: (newReply, _vars, ctx) => {
      qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
        if (!prev) return prev
        const realExists = prev.pages.some((p) =>
          p.rows.some((r) => r.id === newReply.id),
        )
        const pages = prev.pages.map((p) => ({
          ...p,
          rows: p.rows.flatMap((r) => {
            if (r.id === ctx?.tempId) {
              return realExists ? [] : [newReply]
            }
            return [r]
          }),
        }))
        return { ...prev, pages }
      })
    },
    onError: (e, _vars, ctx) => {
      qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
        if (!prev || !ctx?.tempId) return prev
        const pages = prev.pages.map((p) => {
          const filtered = p.rows.filter((r) => r.id !== ctx.tempId)
          return filtered.length === p.rows.length
            ? { ...p, total: Math.max(0, p.total - 1) }
            : { ...p, rows: filtered, total: Math.max(0, p.total - 1) }
        })
        return { ...prev, pages }
      })
      if (ctx?.prevReply) {
        if (ctx.parentId) setNestedDraft(ctx.prevReply)
        else setReply(ctx.prevReply)
      }
      toast.error(e instanceof Error ? e.message : 'Reply failed')
    },
  })

  const voteReply = useMutation({
    mutationFn: async ({ replyId, value }: { replyId: string; value: 1 | -1 }) => {
      if (!user) throw new Error('Sign in to vote')
      const { data: existing, error: selErr } = await supabase
        .from('reply_votes')
        .select('id')
        .eq('reply_id', replyId)
        .eq('user_id', user.id)
        .eq('value', value)
        .maybeSingle()
      if (selErr) throw selErr
      if (existing) {
        const { error } = await supabase.from('reply_votes').delete().eq('id', (existing as { id: string }).id)
        if (error) throw error
        return { replyId, value, removed: true as const }
      }
      const { error } = await supabase
        .from('reply_votes')
        .upsert({ reply_id: replyId, user_id: user.id, value }, { onConflict: 'reply_id,user_id,value' })
      if (error) throw error
      return { replyId, value, removed: false as const }
    },
    onMutate: async ({ replyId, value }) => {
      await qc.cancelQueries({ queryKey: ['replies', threadId] })
      qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
        if (!prev) return prev
        const key = value === 1 ? 'upvotes' : 'downvotes'
        const pages = prev.pages.map((p) => ({
          ...p,
          rows: p.rows.map((r) => (r.id === replyId ? { ...r, [key]: (r[key] ?? 0) + 1 } : r)),
        }))
        return { ...prev, pages }
      })
    },
    onSuccess: async (res) => {
      if (res.removed) {
        qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
          if (!prev) return prev
          const key = res.value === 1 ? 'upvotes' : 'downvotes'
          const pages = prev.pages.map((p) => ({
            ...p,
            rows: p.rows.map((r) =>
              r.id === res.replyId ? { ...r, [key]: Math.max(0, (r[key] ?? 0) - 2) } : r,
            ),
          }))
          return { ...prev, pages }
        })
      }
      const { data } = await supabase.rpc('get_reply_vote_counts', { _reply_ids: [res.replyId] })
      const row = (data as Array<{ reply_id: string; upvotes: number; downvotes: number }> | null)?.[0]
      if (row) {
        qc.setQueryData<InfiniteData<RepliesPage>>(['replies', threadId], (prev) => {
          if (!prev) return prev
          const pages = prev.pages.map((p) => ({
            ...p,
            rows: p.rows.map((r) =>
              r.id === res.replyId
                ? { ...r, upvotes: Number(row.upvotes), downvotes: Number(row.downvotes) }
                : r,
            ),
          }))
          return { ...prev, pages }
        })
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Vote failed'),
  })



  if (threadQ.isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="inline animate-spin mr-2" /> Loading…
      </div>
    )
  }

  const thread = threadQ.data
  if (!thread) {
    return <div className="py-16 text-center text-muted-foreground">Thread not found.</div>
  }

  const replies: Reply[] = useMemo(
    () => repliesQ.data?.pages.flatMap((p) => p.rows) ?? [],
    [repliesQ.data],
  )
  const totalReplies = repliesQ.data?.pages[0]?.total ?? replies.length

  const authorName = thread.profiles?.display_name ?? 'Member'
  const safeBody = DOMPurify.sanitize(thread.content ?? '')

  const plainBody = (thread.content ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  const metaDesc = plainBody.slice(0, 160) || `Discussion by ${authorName} on AbiaConnect.`

  return (
    <>
      <SEO
        title={thread.title}
        description={metaDesc}
        path={`/thread/${threadId ?? ''}`}
        ogType="article"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'DiscussionForumPosting',
            headline: thread.title,
            articleBody: plainBody,
            author: { '@type': 'Person', name: authorName },
            datePublished: thread.created_at,
            url: `https://abiaconnect.com/thread/${threadId}`,
            mainEntityOfPage: { '@type': 'WebPage', '@id': `https://abiaconnect.com/thread/${threadId}` },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://abiaconnect.com/' },
              { '@type': 'ListItem', position: 2, name: thread.categories?.name || 'Forums', item: `https://abiaconnect.com/category/${thread.categories?.id}` },
              { '@type': 'ListItem', position: 3, name: thread.title, item: `https://abiaconnect.com/thread/${threadId}` },
            ],
          },
        ]}
      />
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" />
        {thread.categories ? (
          <Link to={`/category/${thread.categories.id}`} className="hover:text-primary">
            {thread.categories.name}
          </Link>
        ) : (
          <Link to="/" className="hover:text-primary">All Forums</Link>
        )}
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {thread.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/20 text-secondary-foreground px-2 py-0.5 text-xs font-semibold">
              <Pin className="size-3" /> Pinned
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="size-3.5" /> {thread.view_count ?? 0} views
          </span>
        </div>
        <h1 className="text-3xl font-bold">{thread.title}</h1>

        <div className="flex items-start gap-3">
          <Avatar name={authorName} url={thread.profiles?.avatar_url} size={10} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{authorName}</span>
              {thread.profiles?.role && (
                <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">
                  {thread.profiles.role}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {thread.profiles?.created_at &&
                `Joined ${formatDistanceToNow(new Date(thread.profiles.created_at), { addSuffix: true })} · `}
              Posted {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: safeBody }}
        />

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={() => !vote.isPending && vote.mutate(1)}
            disabled={!user || vote.isPending}
            aria-busy={vote.isPending}
          >
            <ThumbsUp /> {thread.upvotes ?? 0}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => !vote.isPending && vote.mutate(-1)}
            disabled={!user || vote.isPending}
            aria-busy={vote.isPending}
          >
            <ThumbsDown /> {thread.downvotes ?? 0}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => bookmark.mutate()} disabled={!user}>
            <Bookmark /> Bookmark
          </Button>
          <Button size="sm" variant="ghost" onClick={share}>
            <Share2 /> Share
          </Button>
        </div>
      </article>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">
          {totalReplies} {totalReplies === 1 ? 'Reply' : 'Replies'}
        </h2>

        {repliesQ.isLoading ? (
          <ul className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="rounded-2xl border border-border bg-card p-4 space-y-2 animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
                <div className="h-3 w-11/12 rounded bg-muted" />
                <div className="h-3 w-9/12 rounded bg-muted" />
              </li>
            ))}
          </ul>
        ) : repliesQ.isError ? (
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">Failed to load replies.</p>
            <Button size="sm" variant="outline" onClick={() => repliesQ.refetch()}>
              Retry
            </Button>
          </div>
        ) : replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {replies.map((r) => {
                const name = r.profiles?.display_name ?? 'Member'
                const isOptimistic = (r as Reply & { _optimistic?: boolean })._optimistic
                return (
                  <li
                    key={r.id}
                    className={`rounded-2xl border border-border bg-card p-4 transition-opacity ${
                      r.parent_reply_id ? 'ml-8' : ''
                    } ${isOptimistic ? 'opacity-60' : ''}`}
                    aria-busy={isOptimistic ? 'true' : undefined}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar name={name} url={r.profiles?.avatar_url} />
                      <span className="font-medium text-sm">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {isOptimistic ? 'Sending…' : formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.content) }}
                    />
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!user || voteReply.isPending || isOptimistic}
                        onClick={() => voteReply.mutate({ replyId: r.id, value: 1 })}
                      >
                        <ThumbsUp className="size-3.5" /> {r.upvotes ?? 0}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!user || voteReply.isPending || isOptimistic}
                        onClick={() => voteReply.mutate({ replyId: r.id, value: -1 })}
                      >
                        <ThumbsDown className="size-3.5" /> {r.downvotes ?? 0}
                      </Button>
                      {user && commentingEnabled && !isOptimistic && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReplyingTo(replyingTo === r.id ? null : r.id)
                            setNestedDraft('')
                          }}
                        >
                          {replyingTo === r.id ? 'Cancel' : 'Reply'}
                        </Button>
                      )}
                    </div>
                    {replyingTo === r.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!nestedDraft.trim()) return
                          submitReply.mutate({ content: nestedDraft, parentId: r.id })
                        }}
                        className="mt-3 space-y-2"
                      >
                        <Textarea
                          value={nestedDraft}
                          onChange={(e) => setNestedDraft(e.target.value)}
                          placeholder={`Reply to ${name}…`}
                          rows={3}
                          maxLength={5000}
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setReplyingTo(null)}>
                            Cancel
                          </Button>
                          <Button type="submit" size="sm" disabled={submitReply.isPending || !nestedDraft.trim()}>
                            {submitReply.isPending ? 'Posting…' : 'Post'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>

            {repliesQ.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => repliesQ.fetchNextPage()}
                  disabled={repliesQ.isFetchingNextPage}
                >
                  {repliesQ.isFetchingNextPage ? (
                    <>
                      <Loader2 className="size-3.5 mr-1 animate-spin" /> Loading…
                    </>
                  ) : (
                    `Load more replies (${Math.max(0, totalReplies - replies.length)} left)`
                  )}
                </Button>
              </div>
            )}
          </>
        )}


        {user ? (
          commentingEnabled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitReply.mutate({ content: reply })
              }}
              className="space-y-2"
            >
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                rows={4}
                maxLength={5000}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={submitReply.isPending || !reply.trim()}>
                  {submitReply.isPending ? 'Posting…' : 'Post Reply'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Commenting is currently disabled.</p>
          )
        ) : (
          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center text-sm">
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>{' '}
            to reply.
          </div>
        )}
      </section>
    </div>
    </>
  )
}
