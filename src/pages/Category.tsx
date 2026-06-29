import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowBigUp,
  ChevronRight,
  Eye,
  Flame,
  MessageSquare,
  Pin,
  Plus,
  Sparkles,
} from 'lucide-react'
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
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

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
  is_anonymous?: boolean | null
  upvotes?: number | null
  view_count?: number | null
  user_id?: string | null
  author_id?: string | null
  reply_count?: number
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null
}

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const invalidateThreads = useThrottledCallback(
    useCallback(() => {
      if (!categoryId) return
      queryClient.invalidateQueries({ queryKey: ['threads', categoryId] })
    }, [queryClient, categoryId]),
    800,
  )

  useRealtimeChannel({
    enabled: !!categoryId,
    channelName: `threads-category:${categoryId ?? 'none'}`,
    deps: [categoryId],
    subscriptions: categoryId
      ? [
          {
            filter: { event: '*', schema: 'public', table: 'threads', filter: `category_id=eq.${categoryId}` },
            handler: invalidateThreads,
          },
          {
            filter: { event: 'INSERT', schema: 'public', table: 'replies' },
            handler: invalidateThreads,
          },
        ]
      : [],
  })


  const categoryQ = useQuery({
    queryKey: ['category', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('id', categoryId!).maybeSingle()
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
      const authorIds = Array.from(new Set(baseRows.map((t) => t.author_id).filter((v): v is string => !!v)))
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
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return arr
  }, [rawThreads, sort])

  const totalReplies = rawThreads.reduce((s, t) => s + (t.reply_count ?? 0), 0)
  const lastActivity = rawThreads[0]?.created_at
  const accentColor = category?.color ?? MOBILE_BRAND.gold

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

      <div className="space-y-6 text-white">
        <nav className="flex items-center gap-1 text-sm text-slate-400">
          <Link to="/" className="hover:text-white">
            Forums
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="truncate font-medium text-slate-100">{category?.name ?? '…'}</span>
        </nav>

        <header
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#091220] p-5 sm:p-6"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div
            className="absolute inset-0 opacity-95"
            style={{
              background:
                'linear-gradient(160deg, rgba(5,12,22,0.98) 10%, rgba(10,20,36,0.96) 55%, rgba(5,11,20,1) 100%)',
            }}
          />
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.16)' }} />
          <div className="absolute -left-8 bottom-0 h-36 w-36 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.16)' }} />

          <div className="relative space-y-5">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200/80"
              style={{ background: GOLD_GRADIENT_SOFT }}
            >
              <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
              Premium category view
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] border text-3xl"
                  style={{ backgroundColor: `${accentColor}22`, borderColor: `${accentColor}4D` }}
                >
                  {category?.icon ?? '💬'}
                </span>
                <div className="min-w-0">
                  <h1 className="text-3xl font-black tracking-tight text-white">{category?.name ?? 'Category'}</h1>
                  {category?.description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300/76">{category.description}</p>
                  ) : null}
                </div>
              </div>

              {user ? (
                <Button asChild className="h-12 rounded-2xl px-5 font-bold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
                  <Link to={`/create-thread?category=${categoryId}`}>
                    <Plus className="mr-2 size-4" /> New Thread
                  </Link>
                </Button>
              ) : (
                <Link to="/login" className="text-sm font-semibold" style={{ color: MOBILE_BRAND.gold }}>
                  Sign in to post
                </Link>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Metric label="Threads" value={String(totalThreads)} />
              <Metric label="Replies" value={String(totalReplies)} />
              <Metric
                label="Last activity"
                value={lastActivity ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true }) : '—'}
                compact
              />
            </div>
          </div>
        </header>

        <section
          className="rounded-[1.8rem] border border-white/10 bg-[rgba(8,14,26,0.92)] p-4 sm:p-5"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Threads in this category</h2>
              <p className="mt-1 text-sm text-slate-300/72">Sort conversations by freshness, reach, engagement, or pinned importance.</p>
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-full rounded-2xl border-white/10 bg-white/[0.04] text-white sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="replies">Most Replied</SelectItem>
                <SelectItem value="views">Most Viewed</SelectItem>
                <SelectItem value="pinned">Pinned First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {threadsQ.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[1.7rem] bg-white/[0.05]" />
            ))}
          </div>
        ) : threadsQ.isError ? (
          <div className="space-y-3 py-16 text-center">
            <p className="text-slate-300/72">Failed to load threads.</p>
            <Button onClick={() => threadsQ.refetch()} className="rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
              Retry
            </Button>
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-16 text-center text-sm text-slate-300/70">
            No threads yet. Be the first to post.
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
                    className="rounded-[1.75rem] border border-white/10 bg-[rgba(8,14,26,0.9)] p-5 transition hover:border-[#F8C301]/20"
                    style={{ boxShadow: '0 18px 50px -34px rgba(7,17,31,0.95)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {t.is_pinned ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                              <Pin className="size-3" /> Pinned
                            </span>
                          ) : null}
                          {replyCount > 10 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#F8C301]/20 px-2.5 py-1 text-[11px] font-semibold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
                              <Flame className="size-3" /> Hot
                            </span>
                          ) : null}
                        </div>

                        <Link to={`/thread/${t.id}`} className="block text-lg font-black tracking-tight text-white transition hover:opacity-90">
                          {t.title}
                        </Link>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                            <UserAvatar avatarUrl={t.profiles?.avatar_url} displayName={author} size="xs" className="border-white/10" />
                            <span className="font-semibold text-slate-100">{author}</span>
                          </div>
                          <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>

                      <div className="grid shrink-0 gap-2 text-right text-[11px] text-slate-300/70">
                        <MetaPill icon={MessageSquare} value={String(replyCount)} />
                        <MetaPill icon={ArrowBigUp} value={String(t.upvotes ?? 0)} />
                        <MetaPill icon={Eye} value={String(t.view_count ?? 0)} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {totalThreads > PAGE_SIZE ? (
              <div className="flex items-center justify-between gap-3 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-400">
                  Page {page + 1} of {Math.max(1, Math.ceil(totalThreads / PAGE_SIZE))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= totalThreads}
                  className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/62">{label}</p>
      <p className={`mt-2 font-black text-white ${compact ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl'}`}>{value}</p>
    </div>
  )
}

function MetaPill({ icon: Icon, value }: { icon: typeof MessageSquare; value: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-semibold text-slate-100">
      <Icon className="size-3.5 text-slate-400" />
      {value}
    </span>
  )
}
