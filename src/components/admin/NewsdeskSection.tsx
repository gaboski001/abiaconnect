import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Check, ExternalLink, FlaskConical, Newspaper, Play, RefreshCw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { sanitizeThreadHtml } from '@/lib/sanitizeThreadHtml'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface Source {
  title: string
  url: string
  publisher: string
}

/** The server's reason for a refused request, e.g. "Too many runs, try again in an hour". */
async function functionErrorMessage(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
      if (body?.note) return String(body.note)
    } catch {
      /* not JSON */
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

async function callBot<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('daily-newsdesk', { body })
  if (error) throw new Error(await functionErrorMessage(error))
  return data as T
}

const DAILY_LIMITS = [3, 5, 8, 10, 15]

/**
 * Admin -> Newsdesk Bot: switch the daily news posts on or off, try a test
 * run, approve or reject the posts that wait for an admin, and see what the
 * bot did.
 */
export default function NewsdeskSection() {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-newsdesk-posts'] })
    qc.invalidateQueries({ queryKey: ['admin-newsdesk-runs'] })
  }

  const settings = useQuery({
    queryKey: ['admin-newsdesk-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('newsdesk_settings').select('*').eq('id', true).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const author = useQuery({
    queryKey: ['admin-newsdesk-author', settings.data?.author_id],
    enabled: !!settings.data?.author_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', settings.data!.author_id!)
        .maybeSingle()
      return data
    },
  })

  const categories = useQuery({
    queryKey: ['admin-newsdesk-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('display_order')
      if (error) throw error
      return (data ?? []).filter((c) => !!c.slug) as { id: string; name: string; slug: string }[]
    },
  })

  const posts = useQuery({
    queryKey: ['admin-newsdesk-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsdesk_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60)
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 30000,
  })

  const runs = useQuery({
    queryKey: ['admin-newsdesk-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('newsdesk_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
  })

  const save = useMutation({
    mutationFn: async (fields: { enabled?: boolean; max_posts_per_day?: number; review_slugs?: string[] }) => {
      const { error } = await supabase
        .from('newsdesk_settings')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', true)
      if (error) throw error
      return fields
    },
    onSuccess: (fields) => {
      qc.invalidateQueries({ queryKey: ['admin-newsdesk-settings'] })
      if (fields.enabled === true) toast.success('The bot is on', { description: 'It will post every morning at 07:30.' })
      else if (fields.enabled === false) toast.success('The bot is off', { description: 'Nothing will be posted until you switch it on.' })
      else toast.success('Saved')
    },
    onError: (e: Error) => toast.error('Could not save', { description: e.message }),
  })

  const run = useMutation({
    mutationFn: (test: boolean) => callBot<{ note?: string; published?: number; held?: number }>(test ? { test: true } : {}),
    onSuccess: (r) => {
      toast.success('The bot has finished', { description: r?.note })
      refresh()
    },
    onError: (e: Error) => {
      toast.error('The bot could not finish', { description: e.message })
      refresh()
    },
  })

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => callBot<{ thread_id?: string }>({ action, id }),
    onSuccess: (_r, v) => {
      toast.success(v.action === 'approve' ? 'Published on the forum' : 'Rejected')
      refresh()
    },
    onError: (e: Error) => {
      toast.error('Could not do that', { description: e.message })
      refresh()
    },
  })

  const forumName = useMemo(() => {
    const map = new Map((categories.data ?? []).map((c) => [c.slug, c.name]))
    return (slug: string) => map.get(slug) ?? slug
  }, [categories.data])

  const s = settings.data
  const waiting = (posts.data ?? []).filter((p) => p.status === 'pending')
  const history = (posts.data ?? []).filter((p) => p.status !== 'pending').slice(0, 20)
  const busy = run.isPending
  const lastRun = runs.data?.[0]

  const toggleReview = (slug: string) => {
    if (!s) return
    const next = s.review_slugs.includes(slug) ? s.review_slugs.filter((x) => x !== slug) : [...s.review_slugs, slug]
    save.mutate({ review_slugs: next })
  }

  if (settings.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (settings.isError || !s) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-destructive">
        The Newsdesk Bot is not set up on the server yet. It appears here once the latest update has been applied.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold flex items-center gap-2">
              <Newspaper className="size-4" /> Newsdesk Bot
            </h2>
            <p className="text-sm text-muted-foreground">
              Every morning it reads the news, picks the freshest story for each forum (Abia stories first) and starts a
              discussion. It only posts in forums that have real news that day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="newsdesk-enabled"
              checked={s.enabled}
              disabled={save.isPending}
              onCheckedChange={(on) => save.mutate({ enabled: on })}
            />
            <Label htmlFor="newsdesk-enabled" className="text-sm">
              {s.enabled ? 'On: posts every morning at 07:30' : 'Off'}
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => run.mutate(true)} disabled={busy}>
            <FlaskConical /> {busy && run.variables === true ? 'Working… about a minute' : 'Test run (nothing goes public)'}
          </Button>
          <Button size="sm" onClick={() => run.mutate(false)} disabled={busy}>
            <Play /> {busy && run.variables === false ? 'Working… about a minute' : 'Run now'}
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={posts.isFetching}>
            <RefreshCw className={posts.isFetching ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          <strong>Test run</strong> writes today's posts and puts all of them below for you to read; nothing is published
          unless you approve it. <strong>Run now</strong> does what the bot does every morning: everyday topics are
          published straight away, sensitive ones wait for you.
        </p>

        <div className="text-sm">
          <span className="text-muted-foreground">Posts as: </span>
          {s.author_id ? (
            <span className="font-medium">{author.data?.display_name || author.data?.username || 'the Newsdesk account'}</span>
          ) : (
            <span className="text-destructive">no account set, so the bot cannot post yet</span>
          )}
        </div>

        {lastRun && (
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <span className="font-medium">Last run</span>{' '}
            <span className="text-muted-foreground">
              ({formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true })}
              {lastRun.trigger === 'test' ? ', test' : lastRun.trigger === 'admin' ? ', started by an admin' : ', automatic'})
            </span>
            : {lastRun.note ?? 'still working…'}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-bold">Waiting for your approval ({waiting.length})</h2>
        {posts.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : waiting.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing is waiting. Posts for the forums ticked below, and any story that looks sensitive, appear here first.
          </div>
        ) : (
          <ul className="space-y-4">
            {waiting.map((p) => (
              <li key={p.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-secondary/10 px-2 py-0.5 font-medium text-secondary">
                    {forumName(p.category_slug)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    {p.scope === 'abia' ? 'Abia story' : 'National story'}
                  </span>
                  <span className="text-muted-foreground">
                    written {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </span>
                </div>
                <h3 className="font-semibold">{p.title}</h3>
                {p.banner_url ? (
                  <img
                    src={p.banner_url}
                    alt={p.banner_title || p.title}
                    width={1200}
                    height={630}
                    loading="lazy"
                    className="h-auto w-full max-w-xl rounded-xl border"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No banner yet. One is made when you approve the post; if that fails, the forum's picture is used.
                  </p>
                )}
                <div
                  className="thread-prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizeThreadHtml(p.content) }}
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  {p.hold_reason && <p>Why it is waiting: {p.hold_reason}.</p>}
                  <p>Please open the report and check the facts before approving:</p>
                  <ul className="space-y-1">
                    {((p.sources ?? []) as unknown as Source[]).map((src) => (
                      <li key={src.url}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline"
                        >
                          <ExternalLink className="size-3" /> {src.publisher}: {src.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => decide.mutate({ id: p.id, action: 'approve' })} disabled={decide.isPending}>
                    <Check /> Approve and publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => decide.mutate({ id: p.id, action: 'reject' })}
                    disabled={decide.isPending}
                  >
                    <X /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-bold">Settings</h2>
        <div className="space-y-2">
          <Label>Most posts in one day</Label>
          <div className="flex flex-wrap gap-2">
            {DAILY_LIMITS.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={s.max_posts_per_day === n ? 'default' : 'outline'}
                disabled={save.isPending}
                onClick={() => save.mutate({ max_posts_per_day: n })}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Forums where every post waits for your approval</Label>
          <p className="text-xs text-muted-foreground">
            In the other forums, posts are published by themselves unless the story looks sensitive (for example deaths,
            crime, court cases or elections).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(categories.data ?? []).map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-current"
                  checked={s.review_slugs.includes(c.slug)}
                  disabled={save.isPending}
                  onChange={() => toggleReview(c.slug)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-bold">Recent posts</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">The bot has not posted anything yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {p.status === 'published' && p.thread_id ? (
                      <Link to={`/thread/${p.thread_id}`} className="hover:underline">
                        {p.title}
                      </Link>
                    ) : (
                      p.title
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {forumName(p.category_slug)} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p.status === 'published' ? (p.reviewed_at ? 'Approved' : 'Published') : 'Rejected'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
