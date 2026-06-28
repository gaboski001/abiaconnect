import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { BookOpen, CalendarDays, ChevronRight, MessageSquarePlus, Sparkles, TrendingUp, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

interface Thread {
  id: string
  title: string
  created_at: string
  user_id?: string | null
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Sparkles
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-[1.7rem] border border-slate-200/80 bg-white/96 p-5 text-slate-950 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
      style={{ boxShadow: PREMIUM_SHADOW }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.06]">
          <Icon className="size-4.5" style={{ color: MOBILE_BRAND.gold }} />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
      </div>
      {children}
    </div>
  )
}

export function SidebarWidgets() {
  const recent = useQuery({
    queryKey: ['recent-threads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as Thread[]
    },
  })

  const members = useQuery({
    queryKey: ['active-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('author_id, created_at, profiles:author_id(display_name, avatar_url)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<{
        author_id: string | null
        created_at: string
        profiles:
          | { display_name?: string | null; avatar_url?: string | null }
          | { display_name?: string | null; avatar_url?: string | null }[]
          | null
      }>
      const seen = new Set<string>()
      const out: Thread[] = []
      for (const row of rows) {
        if (!row.author_id || seen.has(row.author_id)) continue
        seen.add(row.author_id)
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        out.push({
          id: row.author_id,
          title: '',
          created_at: row.created_at,
          user_id: row.author_id,
          profiles: profile ?? null,
        })
        if (out.length === 5) break
      }
      return out
    },
  })

  return (
    <aside className="space-y-5">
      <Card title="Recent Activity" icon={TrendingUp}>
        {recent.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.05]" />
            ))}
          </div>
        ) : !recent.data?.length ? (
          <p className="text-sm text-slate-600 dark:text-slate-300/74">No threads yet.</p>
        ) : (
          <ul className="space-y-3">
            {recent.data.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/thread/${t.id}`}
                  className="block rounded-[1.2rem] border border-slate-200/80 bg-slate-50/90 px-4 py-3 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: MOBILE_BRAND.goldWarm }}>
                      Open <ChevronRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Active Members" icon={Users}>
        {members.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.05]" />
            ))}
          </div>
        ) : !members.data?.length ? (
          <p className="text-sm text-slate-600 dark:text-slate-300/74">No active members yet.</p>
        ) : (
          <ul className="space-y-3">
            {members.data.map((m) => {
              const name = m.profiles?.display_name ?? 'Member'
              return (
                <li
                  key={m.user_id!}
                  className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200/80 bg-slate-50/90 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <UserAvatar
                    avatarUrl={m.profiles?.avatar_url}
                    displayName={name}
                    size="sm"
                    className="border-slate-200 dark:border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Recently active</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Quick Links" icon={BookOpen}>
        <div className="space-y-3">
          <QuickLink to="/forum-guidelines" icon={BookOpen} label="Forum Rules" />
          <QuickLink to="/events" icon={CalendarDays} label="Events" />
          <Link
            to="/create-thread"
            className="flex items-center justify-between rounded-[1.3rem] border px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"
            style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW, borderColor: 'transparent' }}
          >
            <span className="inline-flex items-center gap-2">
              <MessageSquarePlus className="size-4" /> Create Thread
            </span>
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </Card>
    </aside>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof BookOpen
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-[1.2rem] border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.06]"
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="size-4" style={{ color: MOBILE_BRAND.gold }} />
        {label}
      </span>
      <ChevronRight className="size-4 text-slate-400" />
    </Link>
  )
}

export default SidebarWidgets
