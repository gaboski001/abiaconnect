import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessagesSquare, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { UserAvatar } from '@/components/ui/UserAvatar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args)

interface HelperView {
  enabled: boolean
  per_hour: number
  sent_24h: number
  accounts: { user_id: string; name: string; username: string | null; avatar_url: string | null }[]
}

/**
 * Admin -> Helper replies. While switched on, the accounts listed here reply to
 * new posts (once the post is 30 minutes old) so conversations get going while
 * the community is small. Turn it off once members reply to each other.
 */
export default function HelperRepliesSection() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const view = useQuery({
    queryKey: ['admin-helper-replies'],
    queryFn: async () => {
      const { data, error } = await rpc('admin_helper_replies')
      if (error) throw error
      return data as HelperView
    },
  })
  const found = useQuery({
    queryKey: ['admin-find-members', q.trim()],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await rpc('admin_find_members', { _q: q.trim() })
      if (error) throw error
      return (data ?? []) as { user_id: string; display_name: string | null; username: string | null }[]
    },
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-helper-replies'] })

  const save = useMutation({
    mutationFn: async (args: { enabled?: boolean; per_hour?: number }) => {
      const { error } = await rpc('admin_set_helper_replies', { _enabled: args.enabled ?? null, _per_hour: args.per_hour ?? null })
      if (error) throw error
      return args
    },
    onSuccess: (args) => {
      if (args.enabled !== undefined) toast.success(args.enabled ? 'Helper replies are on' : 'Helper replies are off')
      refresh()
    },
    onError: () => toast.error('Could not save that. Please try again.'),
  })
  const account = useMutation({
    mutationFn: async ({ id, add }: { id: string; add: boolean }) => {
      const { error } = await rpc('admin_helper_reply_account', { _user_id: id, _add: add })
      if (error) throw error
    },
    onSuccess: () => {
      setQ('')
      refresh()
    },
    onError: () => toast.error('Could not change the list. Please try again.'),
  })

  const v = view.data
  const listed = new Set(v?.accounts.map((a) => a.user_id))

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-bold">
              <MessagesSquare className="size-4" /> Helper replies
            </h2>
            <p className="text-sm text-muted-foreground">Get conversations going while the community is still small.</p>
          </div>
          {v ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={v.enabled} onCheckedChange={(on) => save.mutate({ enabled: on })} disabled={save.isPending} />
              {v.enabled ? 'On' : 'Off'}
            </label>
          ) : null}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Once a post is 30 minutes old, one of the accounts below replies with a short, friendly line using the poster’s first name.</li>
          <li>At most two helper replies per post, from two different accounts. Posts that already have 4 or more replies are left alone.</li>
          <li>Never in the sensitive forums (the ones the Newsdesk sends for approval), never on welcome posts, and not between 23:00 and 07:00.</li>
          <li>Helper replies don’t count as an answer, so champions and admins still get “no reply yet” alerts.</li>
          <li>Turn this off once members are replying to each other.</li>
        </ul>
        {v ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>At most</span>
            <Input
              type="number"
              min={1}
              max={30}
              defaultValue={v.per_hour}
              className="h-9 w-20"
              aria-label="Helper replies per hour"
              onBlur={(e) => {
                const n = Number(e.target.value)
                if (n >= 1 && n <= 30 && n !== v.per_hour) save.mutate({ per_hour: n })
              }}
            />
            <span>replies an hour · {v.sent_24h} sent in the last 24 hours</span>
          </div>
        ) : view.isError ? (
          <p className="text-sm text-destructive">Could not load the settings.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h3 className="font-semibold">Helper accounts</h3>
        <p className="text-sm text-muted-foreground">
          Add the accounts you registered yourself. Each needs a real name and a profile picture to look right.
        </p>
        {v && v.accounts.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">No accounts yet, so nothing is sent even when it’s on.</p>
        ) : null}
        <ul className="divide-y rounded-xl border empty:hidden">
          {v?.accounts.map((a) => (
            <li key={a.user_id} className="flex items-center gap-3 p-3">
              <UserAvatar avatarUrl={a.avatar_url} displayName={a.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.name}</div>
                {a.username ? <div className="text-xs text-muted-foreground">@{a.username}</div> : null}
              </div>
              <Button size="sm" variant="ghost" onClick={() => account.mutate({ id: a.user_id, add: false })} aria-label={`Remove ${a.name}`}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an account by name or username" aria-label="Find an account" />
        {found.data?.length ? (
          <ul className="divide-y rounded-xl border">
            {found.data.slice(0, 8).map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {m.display_name || m.username} {m.username ? <span className="text-muted-foreground">@{m.username}</span> : null}
                </span>
                {listed.has(m.user_id) ? (
                  <span className="text-xs text-muted-foreground">Added</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => account.mutate({ id: m.user_id, add: true })}>
                    <Plus className="size-4" /> Add
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
