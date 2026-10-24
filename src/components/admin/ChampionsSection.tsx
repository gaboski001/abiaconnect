import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Plus, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { loadWaitingPosts } from '@/components/engagement/WaitingForReplyCard'

const sb = supabase as any

interface Group {
  id: string
  name: string
  kind: string
}
interface Person {
  id: string
  display_name: string | null
  lga?: string | null
}

/**
 * LGA champions: trusted members who greet newcomers and answer posts in a
 * group. They get an alert for every introduction there and for any member
 * post nobody has answered after 2 hours. Below: the posts waiting right now.
 */
export function ChampionsSection() {
  const qc = useQueryClient()
  const groupsQ = useQuery({
    queryKey: ['admin-champion-groups'],
    queryFn: async () => {
      const { data, error } = await sb.from('subgroups').select('id, name, kind').eq('is_active', true).order('name')
      if (error) throw error
      const rows = (data ?? []) as Group[]
      // LGA groups first: that's where newcomers arrive.
      return [...rows.filter((g) => g.kind === 'lga'), ...rows.filter((g) => g.kind !== 'lga')]
    },
  })
  const championsQ = useQuery({
    queryKey: ['admin-champions'],
    queryFn: async () => {
      const { data, error } = await sb.from('group_champions').select('subgroup_id, user_id')
      if (error) return null
      const rows = (data ?? []) as { subgroup_id: string; user_id: string }[]
      const ids = [...new Set(rows.map((r) => r.user_id))]
      const names = new Map<string, string>()
      if (ids.length) {
        const { data: profs } = await supabase.rpc('get_public_profiles', { _ids: ids })
        for (const p of (profs ?? []) as Person[]) names.set(p.id, p.display_name || 'Member')
      }
      const byGroup = new Map<string, Person[]>()
      for (const r of rows) {
        const list = byGroup.get(r.subgroup_id) ?? []
        list.push({ id: r.user_id, display_name: names.get(r.user_id) ?? 'Member' })
        byGroup.set(r.subgroup_id, list)
      }
      return byGroup
    },
  })
  const waitingQ = useQuery({ queryKey: ['admin-waiting-posts'], queryFn: () => loadWaitingPosts(20), staleTime: 60_000 })

  const setChampion = useMutation({
    mutationFn: async ({ group, user, on }: { group: string; user: string; on: boolean }) => {
      const { error } = await sb.rpc('admin_set_group_champion', { _subgroup: group, _user: user, _on: on })
      if (error) throw new Error(error.message)
      return on
    },
    onSuccess: (on) => {
      toast.success(on ? 'Champion added. They have been told by notification.' : 'Champion removed')
      qc.invalidateQueries({ queryKey: ['admin-champions'] })
    },
    onError: (e: Error) => toast.error('Could not save', { description: e.message }),
  })

  if (championsQ.data === null) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        LGA champions appear here once the latest database update has been applied.
      </div>
    )
  }
  const champions = championsQ.data ?? new Map<string, Person[]>()
  const groups = groupsQ.data ?? []
  const covered = groups.filter((g) => g.kind === 'lga' && (champions.get(g.id)?.length ?? 0) > 0).length
  const lgaCount = groups.filter((g) => g.kind === 'lga').length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">Waiting for a reply</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Members' posts from the last 7 days that nobody has answered. Reply as yourself: a real person answering is what
          makes people come back.
        </p>
        {waitingQ.isLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded-lg bg-muted" />
        ) : !waitingQ.data?.length ? (
          <p className="mt-3 text-sm">Every member post has a reply. 🎉</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border">
            {waitingQ.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.author_name}
                    {p.group_name ? ` · ${p.group_name}` : ''} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </span>
                </span>
                <Link to={`/thread/${p.id}`} className="font-medium text-primary hover:underline">
                  Reply
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">LGA champions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick 1 or 2 trusted, friendly members for each group. They get an alert whenever someone new says hello there,
          and when a post in the group has had no reply for 2 hours. Ask them first, then add them here.
        </p>
        <p className="mt-2 text-sm font-medium">
          {covered} of {lgaCount} LGA groups have a champion.
        </p>
        <ul className="mt-3 divide-y rounded-xl border">
          {groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              champions={champions.get(g.id) ?? []}
              busy={setChampion.isPending}
              onAdd={(user) => setChampion.mutate({ group: g.id, user, on: true })}
              onRemove={(user) => setChampion.mutate({ group: g.id, user, on: false })}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

function GroupRow({
  group,
  champions,
  busy,
  onAdd,
  onRemove,
}: {
  group: Group
  champions: Person[]
  busy: boolean
  onAdd: (user: string) => void
  onRemove: (user: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [term, setTerm] = useState('')
  const searchQ = useQuery({
    queryKey: ['admin-champion-search', term],
    enabled: adding && term.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users', { _search: term.trim(), _limit: 6, _offset: 0 })
      if (error) throw error
      return ((data ?? []) as Person[]).filter((p) => !champions.some((c) => c.id === p.id))
    },
  })

  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-medium">{group.name}</span>
        {champions.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-800 dark:text-emerald-300">
            🏅 {c.display_name}
            <button type="button" aria-label={`Remove ${c.display_name}`} disabled={busy} onClick={() => onRemove(c.id)} className="rounded-full p-0.5 hover:bg-emerald-500/20">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" /> Add champion
        </button>
      </div>
      {adding ? (
        <div className="space-y-2">
          <Input autoFocus placeholder="Type a member's name" value={term} onChange={(e) => setTerm(e.target.value)} />
          {searchQ.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          {searchQ.data?.length ? (
            <ul className="flex flex-wrap gap-2">
              {searchQ.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      onAdd(p.id)
                      setAdding(false)
                      setTerm('')
                    }}
                    className="rounded-full border px-3 py-1 hover:border-primary hover:text-primary"
                  >
                    {p.display_name || 'Member'}
                    {p.lga ? <span className="text-muted-foreground"> · {p.lga}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : term.trim().length >= 2 && searchQ.isFetched ? (
            <p className="text-xs text-muted-foreground">No member found with that name.</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
