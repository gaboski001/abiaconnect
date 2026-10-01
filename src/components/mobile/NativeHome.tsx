import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ChevronRight, Eye, MessageCircle, PenSquare, Pin, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { HeroSlider } from '@/components/forum/HeroSlider'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'

interface Category {
  id: string
  name: string
  slug: string | null
  icon: string | null
  color: string | null
  thread_count: number
  is_popular: boolean
}

interface FeedThread {
  id: string
  title: string
  created_at: string
  is_pinned: boolean
  is_anonymous: boolean
  view_count: number
  author_id: string | null
  reply_count: number
  category: { name: string; icon: string | null } | null
  author: { display_name: string | null; avatar_url: string | null } | null
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The app's home screen: a personal welcome, admin announcements, the latest
 * discussions and the forum topics — laid out for a phone, with one obvious
 * next step ("Start a discussion" for members, "Join" for visitors).
 */
export function NativeHome() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const firstName = (profile?.display_name || profile?.username || '').split(' ')[0]

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })

  const feedQ = useQuery({
    queryKey: ['native-home-feed'],
    staleTime: 30_000,
    queryFn: async (): Promise<FeedThread[]> => {
      const { data, error } = await supabase
        .from('threads')
        .select(
          'id, title, created_at, is_pinned, is_anonymous, view_count, author_id, replies(count), categories(name, icon)',
        )
        .eq('is_deleted', false)
        .is('subgroup_id', null)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<
        Omit<FeedThread, 'reply_count' | 'category' | 'author'> & {
          replies?: { count: number }[]
          categories?: { name: string; icon: string | null } | { name: string; icon: string | null }[] | null
        }
      >
      const ids = Array.from(
        new Set(rows.filter((r) => !r.is_anonymous && r.author_id).map((r) => r.author_id as string)),
      )
      const profiles = new Map<string, { display_name: string | null; avatar_url: string | null }>()
      if (ids.length) {
        const { data: profs } = await supabase.rpc('get_public_profiles', { _ids: ids })
        for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>) {
          profiles.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url })
        }
      }
      return rows.map((r) => ({
        ...r,
        reply_count: r.replies?.[0]?.count ?? 0,
        category: Array.isArray(r.categories) ? r.categories[0] ?? null : r.categories ?? null,
        author: !r.is_anonymous && r.author_id ? profiles.get(r.author_id) ?? null : null,
      }))
    },
  })

  return (
    <div className="-mx-4 -mt-4 space-y-7">
      {/* Welcome */}
      <section className="relative overflow-hidden px-4 pb-1 pt-6">
        <div
          className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full blur-3xl"
          style={{ background: 'rgba(248,195,1,0.10)' }}
          aria-hidden
        />
        {user ? (
          <>
            <p className="text-[14px] font-medium text-muted-foreground">{greeting()}</p>
            <h1 className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
              {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">
              Catch up on what Abians are talking about today.
            </p>
            <Link
              to="/create-thread"
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-[#0B1F0B] active:scale-[0.98]"
              style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
            >
              <PenSquare className="size-[18px]" />
              Start a discussion
            </Link>
          </>
        ) : (
          <>
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-500 dark:text-amber-300">
              <Sparkles className="size-4" /> Welcome to AbiaConnect
            </p>
            <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
              The trusted digital home for Abians worldwide
            </h1>
            <p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">
              Join conversations, meet professionals and stay informed.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Link
                to="/register"
                className="flex h-12 items-center justify-center rounded-xl text-[15px] font-bold text-[#0B1F0B]"
                style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              >
                Join free
              </Link>
              <Link
                to="/login"
                className="flex h-12 items-center justify-center rounded-xl border border-border bg-card text-[15px] font-semibold text-foreground"
              >
                Sign in
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Admin announcements / featured */}
      <section className="px-4">
        <HeroSlider />
      </section>

      {/* Latest discussions */}
      <section className="px-4">
        <SectionHeader title="Latest discussions" />
        {feedQ.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : feedQ.isError ? (
          <ErrorCard onRetry={() => feedQ.refetch()} />
        ) : !feedQ.data?.length ? (
          <EmptyCard text="No discussions yet. Be the first to start one." />
        ) : (
          <ul className="space-y-2.5">
            {feedQ.data.map((t) => {
              const name = t.is_anonymous ? 'Anonymous member' : t.author?.display_name || 'Member'
              return (
                <li key={t.id}>
                  <Link
                    to={`/thread/${t.id}`}
                    className="block rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted"
                  >
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      {t.category ? (
                        <span className="inline-flex max-w-[55%] items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                          <span aria-hidden>{t.category.icon ?? '💬'}</span>
                          <span className="truncate">{t.category.name}</span>
                        </span>
                      ) : null}
                      {t.is_pinned ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600 dark:text-amber-300">
                          <Pin className="size-3" /> Pinned
                        </span>
                      ) : null}
                      <span className="ml-auto shrink-0">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">{t.title}</h3>
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                      <UserAvatar
                        avatarUrl={t.author?.avatar_url}
                        displayName={name}
                        size="xs"
                        className="h-5 w-5 border-0"
                      />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="size-3.5" /> {t.reply_count}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" /> {t.view_count}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Topics */}
      <section className="px-4">
        <SectionHeader title="Browse topics" />
        {categoriesQ.isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : categoriesQ.isError ? (
          <ErrorCard onRetry={() => categoriesQ.refetch()} />
        ) : !categoriesQ.data?.length ? (
          <EmptyCard text="Topics will appear here soon." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {categoriesQ.data.map((c) => {
              const color = c.color ?? '#1B3D1B'
              const href = c.slug === 'relationship' ? '/relationship' : `/category/${c.id}`
              return (
                <Link
                  key={c.id}
                  to={href}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors active:bg-muted"
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${color}26` }}
                    aria-hidden
                  >
                    {c.icon ?? '💬'}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[14px] font-semibold leading-tight text-foreground">{c.name}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {c.thread_count ?? 0} {c.thread_count === 1 ? 'thread' : 'threads'}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[18px] font-bold tracking-tight text-foreground">{title}</h2>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-[14px] text-muted-foreground">
      {text}
    </div>
  )
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <p className="text-[14px] text-muted-foreground">Couldn’t load this right now.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-amber-600 dark:text-amber-300"
      >
        Try again <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export default NativeHome
