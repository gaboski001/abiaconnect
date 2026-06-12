import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowBigUp, ChevronRight, Eye, Flame, MessageSquare, Pin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SEO } from '@/components/SEO'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface Category {
  id: string
  name: string
  description?: string | null
  thread_count?: number | null
  icon?: string | null
  color?: string | null
}

type SortKey = 'latest' | 'replies' | 'views' | 'pinned'

interface Thread {
  id: string
  title: string
  created_at: string
  is_pinned?: boolean | null
  upvotes?: number | null
  view_count?: number | null
  user_id?: string | null
  reply_count?: number
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null
}

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!categoryId) return
    const channel = supabase
      .channel(`threads-category:${categoryId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'threads', filter: `category_id=eq.${categoryId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['threads', categoryId] })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replies' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['threads', categoryId] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [categoryId, queryClient])

  const categoryQ = useQuery({
    queryKey: ['category', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId!)
        .maybeSingle()
      if (error) throw error
      return data as Category | null
    },
  })

  const PAGE_SIZE = 20
  const [page, setPage] = useState(0)

  const threadsQ = useQuery({
    queryKey: ['threads', categoryId, page],
    enabled: !!categoryId,
    staleTime: 30_000,
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('threads')
        .select(
          'id, category_id, user_id, author_id, title, tags, is_pinned, is_anonymous, upvotes, view_count, created_at, replies(count)',
          { count: 'exact' },
        )
        .eq('category_id', categoryId!)
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      const baseRows = (data ?? []) as Array<Thread & { replies?: { count: number }[]; is_anonymous?: boolean | null }>
      const authorIds = Array.from(
        new Set(baseRows.map((t) => t.author_id).filter((v): v is string => !!v)),
      )
      let profMap = new Map<string, { display_name: string | null; avatar_url: string | null }>()
      if (authorIds.length > 0) {
        const { data: profs } = await supabase.rpc('get_public_profiles', { _ids: authorIds })
        profMap = new Map(
          ((profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>).map((p) => [
            p.id,
            { display_name: p.display_name, avatar_url: p.avatar_url },
          ]),
        )
      }
      const rows = baseRows.map((t) => ({
        ...t,
        reply_count: t.replies?.[0]?.count ?? 0,
        profiles: t.author_id ? profMap.get(t.author_id) ?? null : null,
      })) as Thread[]
      return { rows, total: count ?? rows.length }
    },
  })

  const category = categoryQ.data
  const rawThreads = threadsQ.data?.rows ?? []
  const totalThreads = threadsQ.data?.total ?? 0
  const [sort, setSort] = useState<SortKey>('latest')


  const threads = useMemo(() => {
    const arr = [...rawThreads]
    if (sort === 'pinned') {
      arr.sort((a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned))
    } else if (sort === 'replies') {
      arr.sort((a, b) => (b.reply_count ?? 0) - (a.reply_count ?? 0))
    } else if (sort === 'views') {
      arr.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    } else {
      arr.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    return arr
  }, [rawThreads, sort])

  const totalReplies = rawThreads.reduce((s, t) => s + (t.reply_count ?? 0), 0)
  const lastActivity = rawThreads[0]?.created_at

  return (
    <>
      <SEO
        title={category?.name ? `${category.name} discussions` : 'Category'}
        description={category?.description ?? `Browse threads and discussions in the ${category?.name ?? 'category'} on AbiaConnect.`}
        path={`/category/${categoryId ?? ''}`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: category?.name || 'Category',
            description: category?.description || `Browse threads in the ${category?.name || 'category'} on AbiaConnect.`,
            url: `https://abiaconnect.com/category/${categoryId}`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://abiaconnect.com/' },
              { '@type': 'ListItem', position: 2, name: category?.name || 'Category', item: `https://abiaconnect.com/category/${categoryId}` },
            ],
          },
        ]}
      />
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground flex items-center gap-1">
        <Link to="/" className="hover:text-foreground">Forums</Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium truncate">{category?.name ?? '…'}</span>
      </nav>

      <header className="rounded-2xl border border-border bg-card p-6 flex items-start gap-5">
        <span
          className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl border shrink-0"
          style={{
            backgroundColor: `${category?.color ?? '#013220'}26`,
            borderColor: `${category?.color ?? '#013220'}4D`,
          }}
        >
          {category?.icon ?? '💬'}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{category?.name ?? 'Category'}</h1>
          {category?.description && (
            <p className="text-muted-foreground mt-1">{category.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
            <span>{totalThreads} threads</span>
            <span>{totalReplies} replies on this page</span>
            {lastActivity && (
              <span>
                Last activity {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </header>


      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="replies">Most Replied</SelectItem>
            <SelectItem value="views">Most Viewed</SelectItem>
            <SelectItem value="pinned">Pinned First</SelectItem>
          </SelectContent>
        </Select>
        {user ? (
          <Button asChild>
            <Link to={`/create-thread?category=${categoryId}`}>
              <Plus className="size-4 mr-1" /> New Thread
            </Link>
          </Button>
        ) : (
          <Link to="/login" className="text-sm font-semibold text-secondary hover:underline">
            Sign in to post
          </Link>
        )}
      </div>


      {threadsQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : threadsQ.isError ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-muted-foreground">Failed to load threads.</p>
          <Button onClick={() => threadsQ.refetch()}>Retry</Button>
        </div>
      ) : threads.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No threads yet. Be the first to post!
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {threads.map((t) => {
              const author = t.profiles?.display_name ?? 'Member'
              const replyCount = t.reply_count ?? 0
              return (
                <li
                  key={t.id}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {t.is_pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/20 text-secondary-foreground px-2 py-0.5 text-xs font-semibold">
                            <Pin className="size-3" /> Pinned
                          </span>
                        )}
                        {replyCount > 10 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-xs font-semibold">
                            <Flame className="size-3" /> Hot
                          </span>
                        )}
                      </div>
                      <Link to={`/thread/${t.id}`} className="block font-bold text-lg hover:text-primary">
                        {t.title}
                      </Link>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <UserAvatar avatarUrl={t.profiles?.avatar_url} displayName={author} size="xs" />
                        <span className="font-medium text-foreground">{author}</span>
                        <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
                        <MessageSquare className="size-4" />
                        {replyCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ArrowBigUp className="size-3.5" />
                        {t.upvotes ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" />
                        {t.view_count ?? 0}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {totalThreads > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil(totalThreads / PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= totalThreads}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

    </div>
    </>
  )
}
