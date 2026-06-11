import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import DOMPurify from 'dompurify'
import {
  Bookmark,
  ChevronLeft,
  Loader2,
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

interface ThreadRow {
  id: string
  title: string
  content?: string | null
  created_at: string
  user_id?: string | null
  category_id?: string | null
  upvotes?: number | null
  downvotes?: number | null
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
  const cls = `h-${size} w-${size} rounded-full`
  return url ? (
    <img src={url} alt={`Profile photo of ${name}`} className={`${cls} object-cover`} />
  ) : (
    <span
      className={`${cls} bg-gradient-to-br from-primary to-secondary text-primary-foreground flex items-center justify-center text-xs font-semibold`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export default function Thread() {
  const { threadId } = useParams<{ threadId: string }>()
  const { user } = useAuth()
  const { settings } = useSiteSettings()
  const qc = useQueryClient()
  const [reply, setReply] = useState('')
  const commentingEnabled = settings.global_commenting_enabled !== 'false'

  const threadQ = useQuery({
    queryKey: ['thread', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('*, categories(id, name), profiles(display_name, avatar_url, bio, role, created_at)')
        .eq('id', threadId!)
        .maybeSingle()
      if (error) throw error
      return data as ThreadRow | null
    },
  })

  const repliesQ = useQuery({
    queryKey: ['replies', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('replies')
        .select('*, profiles(display_name, avatar_url)')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Reply[]
    },
  })

  // Realtime subscription
  useEffect(() => {
    if (!threadId) return
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          qc.setQueryData<Reply[]>(['replies', threadId], (prev = []) => {
            const next = payload.new as Reply
            if (prev.some((r) => r.id === next.id)) return prev
            return [...prev, next]
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
      const { error } = await supabase
        .from('thread_votes')
        .upsert(
          { thread_id: threadId, user_id: user.id, value },
          { onConflict: 'thread_id,user_id' },
        )
      if (error) throw error
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Vote failed'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['thread', threadId] }),
  })

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

  const submitReply = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !threadId) throw new Error('Sign in to reply')
      const trimmed = content.trim()
      if (trimmed.length === 0 || trimmed.length > 5000) throw new Error('Reply must be 1–5000 characters')
      const { data, error } = await supabase
        .from('replies')
        .insert({ thread_id: threadId, user_id: user.id, content: trimmed })
        .select('*, profiles(display_name, avatar_url)')
        .single()
      if (error) throw error
      return data as Reply
    },
    onSuccess: (newReply) => {
      qc.setQueryData<Reply[]>(['replies', threadId], (prev = []) =>
        prev.some((r) => r.id === newReply.id) ? prev : [...prev, newReply],
      )
      setReply('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Reply failed'),
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

  const replies = repliesQ.data ?? []
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
          <Button size="sm" variant="outline" onClick={() => vote.mutate(1)} disabled={!user}>
            <ThumbsUp /> {thread.upvotes ?? 0}
          </Button>
          <Button size="sm" variant="outline" onClick={() => vote.mutate(-1)} disabled={!user}>
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
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        {repliesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading replies…</p>
        ) : replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          <ul className="space-y-3">
            {replies.map((r) => {
              const name = r.profiles?.display_name ?? 'Member'
              return (
                <li
                  key={r.id}
                  className={`rounded-2xl border border-border bg-card p-4 ${
                    r.parent_reply_id ? 'ml-8' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar name={name} url={r.profiles?.avatar_url} />
                    <span className="font-medium text-sm">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.content) }}
                  />
                  <div className="flex items-center gap-1 mt-2">
                    <Button size="sm" variant="ghost" disabled={!user}>
                      <ThumbsUp className="size-3.5" /> {r.upvotes ?? 0}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!user}>
                      <ThumbsDown className="size-3.5" /> {r.downvotes ?? 0}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {user ? (
          commentingEnabled ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitReply.mutate(reply)
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
