import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { HeartHandshake } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CollapsibleCard } from '@/components/community/CollapsibleCard'
import { cn } from '@/lib/utils'

const sb = supabase as any

export interface WaitingPost {
  id: string
  title: string
  created_at: string
  group_name: string | null
  author_name: string
}

/** Members' posts nobody has answered: all of them for admins, their groups' for champions. */
export async function loadWaitingPosts(limit: number): Promise<WaitingPost[]> {
  const { data, error } = await sb.rpc('posts_waiting_for_reply', { _limit: limit })
  // Before the database update, or for everyone else: nothing.
  if (error) return []
  return (data ?? []) as WaitingPost[]
}

/**
 * For LGA champions and admins: the members waiting for someone to answer
 * them. Nobody should post into silence.
 */
export function WaitingForReplyCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const waitingQ = useQuery({
    queryKey: ['posts-waiting-for-reply', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => loadWaitingPosts(5),
  })
  const posts = waitingQ.data ?? []
  if (!posts.length) return null
  return (
    <CollapsibleCard
      name="waiting-for-reply"
      className={cn('border-rose-500/30 bg-rose-500/[0.05]', compact ? 'p-4' : 'p-5')}
      title={
        <>
          <HeartHandshake className="size-4 text-rose-600 dark:text-rose-400" /> Waiting for your reply
        </>
      }
    >
      <p className="text-xs text-muted-foreground">Nobody has answered these members yet. A quick reply makes them feel at home.</p>
      <ul className="mt-3 space-y-2">
        {posts.map((p) => (
          <li key={p.id}>
            <Link to={`/thread/${p.id}`} className="block rounded-xl border border-border bg-card px-3 py-2 transition-colors hover:border-primary">
              <span className="line-clamp-2 text-sm font-medium text-foreground">{p.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {p.author_name}
                {p.group_name ? ` · ${p.group_name}` : ''} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </CollapsibleCard>
  )
}
