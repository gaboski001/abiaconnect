import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { BookOpen, CalendarDays, MessageSquarePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface Thread {
  id: string
  title: string
  created_at: string
  user_id?: string | null
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-bold mb-4">{title}</h3>
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
        profiles: { display_name?: string | null; avatar_url?: string | null } | { display_name?: string | null; avatar_url?: string | null }[] | null
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
    <aside className="space-y-6">
      <Card title="Recent Activity">
        {recent.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !recent.data?.length ? (
          <p className="text-sm text-muted-foreground">No threads yet.</p>
        ) : (
          <ul className="space-y-3">
            {recent.data.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/thread/${t.id}`}
                  className="block text-sm font-medium hover:text-primary line-clamp-2"
                >
                  {t.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Active Members">
        {members.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !members.data?.length ? (
          <p className="text-sm text-muted-foreground">No active members yet.</p>
        ) : (
          <ul className="space-y-3">
            {members.data.map((m) => {
              const name = m.profiles?.display_name ?? 'Member'
              return (
                <li key={m.user_id!} className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={m.profiles?.avatar_url}
                    displayName={name}
                    size="sm"
                    className="border-0"
                  />
                  <span className="text-sm font-medium truncate">{name}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Quick Links">
        <ul className="space-y-2 text-sm">
          <li>
            <Link to="/guidelines" className="flex items-center gap-2 hover:text-primary">
              <BookOpen className="size-4" /> Forum Rules
            </Link>
          </li>
          <li>
            <Link to="/events" className="flex items-center gap-2 hover:text-primary">
              <CalendarDays className="size-4" /> Events
            </Link>
          </li>
          <li>
            <Link to="/create-thread" className="flex items-center gap-2 hover:text-primary">
              <MessageSquarePlus className="size-4" /> Create Thread
            </Link>
          </li>
        </ul>
      </Card>
    </aside>
  )
}

export default SidebarWidgets
