import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { listTrusted, setTrusted } from '@/lib/community'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Admin -> Trusted members: businesses and professionals you have checked. */
export function TrustedMembersSection() {
  const qc = useQueryClient()
  const [term, setTerm] = useState('')
  const q = term.trim()

  const trustedQ = useQuery({ queryKey: ['admin-trusted'], queryFn: listTrusted, retry: false })
  const searchQ = useQuery({
    queryKey: ['admin-trusted-search', q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const like = `%${q.replace(/[\\%_,()]/g, ' ')}%`
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .limit(10)
      if (error) throw error
      return data ?? []
    },
  })

  const save = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => setTrusted(id, on),
    onSuccess: (_, { on }) => {
      toast.success(on ? 'Marked as trusted. They have been told by notification.' : 'Trusted mark removed')
      qc.invalidateQueries({ queryKey: ['admin-trusted'] })
      qc.invalidateQueries({ queryKey: ['member-labels'] })
      setTerm('')
    },
    onError: (e: Error) => toast.error('Could not save', { description: e.message }),
  })

  if (trustedQ.isError) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Trusted members appear here once the latest database update has been applied.
      </div>
    )
  }

  const trustedIds = new Set((trustedQ.data ?? []).map((t) => t.user_id))

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="font-bold">Trusted members</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give the blue tick only to businesses and professionals you have checked. It tells members they can deal with this person with more confidence.
        </p>
      </div>

      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search a member by name or username" aria-label="Search members" />

      {q.length >= 2 ? (
        <ul className="divide-y rounded-xl border">
          {(searchQ.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
              <UserAvatar avatarUrl={p.avatar_url} displayName={p.display_name ?? 'Member'} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {p.display_name || 'Member'} {p.username ? <span className="font-normal text-muted-foreground">@{p.username}</span> : null}
              </span>
              <Button size="sm" disabled={trustedIds.has(p.id) || save.isPending} onClick={() => save.mutate({ id: p.id, on: true })}>
                <BadgeCheck className="size-4" /> {trustedIds.has(p.id) ? 'Trusted' : 'Mark trusted'}
              </Button>
            </li>
          ))}
          {searchQ.isFetched && !searchQ.data?.length ? <li className="p-3 text-sm text-muted-foreground">Nobody found.</li> : null}
        </ul>
      ) : null}

      {trustedQ.data?.length ? (
        <ul className="divide-y rounded-xl border">
          {trustedQ.data.map((t) => (
            <li key={t.user_id} className="flex items-center gap-3 p-3 text-sm">
              <UserAvatar avatarUrl={t.avatar_url} displayName={t.display_name ?? 'Member'} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{t.display_name || t.username || 'Member'}</span>
              <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ id: t.user_id, on: false })}>
                <X className="size-4" /> Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nobody is marked as trusted yet.</p>
      )}
    </section>
  )
}
