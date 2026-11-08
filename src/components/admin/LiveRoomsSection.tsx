import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Loader2, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { liveAction } from '@/lib/live'
import { Input } from '@/components/ui/input'

const sb = supabase as any

interface Overview {
  settings: {
    enabled: boolean
    testers_only: boolean
    max_rooms_at_once: number
    room_minutes: number
    max_listeners: number
    monthly_minutes: number
  }
  minutes_this_month: number
  testers: { user_id: string; name: string }[]
  stopped_hosts: { user_id: string; name: string; reason: string | null }[]
  rooms: {
    id: string
    title: string
    status: 'live' | 'ended'
    host_id: string
    host_name: string
    started_at: string
    ended_reason: string | null
    peak_listeners: number
    minutes: number
    open_reports: number
  }[]
  reports: {
    id: string
    room_id: string
    room_title: string
    reason: string
    created_at: string
    reporter: string
    reported_user_id: string | null
    reported: string | null
  }[]
}

/**
 * Live rooms: the on/off switch, testers, free-plan limits, rooms and reports.
 * Starts off and testers-only; admins can always try rooms themselves.
 */
export function LiveRoomsSection() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['admin-live'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc('admin_live_overview')
      if (error) return null
      return data as Overview
    },
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-live'] })
  const call = useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      const { error } = await sb.rpc(fn, args)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Saved')
      refresh()
    },
    onError: (e: Error) => toast.error('Could not save', { description: e.message }),
  })
  const endRoom = useMutation({
    mutationFn: (roomId: string) => liveAction({ action: 'end', room_id: roomId }),
    onSuccess: () => {
      toast.success('Room ended')
      refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />
  if (!q.data) {
    return (
      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
        Live rooms appear here once the latest database update has been applied.
      </div>
    )
  }
  const { settings: s, minutes_this_month: used, testers, stopped_hosts, rooms, reports } = q.data
  const save = (patch: Partial<Overview['settings']>) =>
    call.mutate({
      fn: 'admin_live_settings',
      args: {
        _enabled: patch.enabled ?? null,
        _testers_only: patch.testers_only ?? null,
        _max_rooms_at_once: patch.max_rooms_at_once ?? null,
        _room_minutes: patch.room_minutes ?? null,
        _max_listeners: patch.max_listeners ?? null,
        _monthly_minutes: patch.monthly_minutes ?? null,
      },
    })
  const state = !s.enabled ? 'Off (only admins can use it)' : s.testers_only ? 'On for testers only' : 'On for everyone'

  return (
    <div className="space-y-6">
      <LiveServiceKeys />
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">Live rooms</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Audio rooms where a member talks live and others listen. Hosts: Level 5 or Premium/VIP, account 30+ days old, and
          running a group with a post in the last 14 days. Admins can always host and join.
        </p>
        <p className="mt-3 text-sm">
          Now: <span className="font-semibold">{state}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={call.isPending}
            onClick={() => save({ enabled: !s.enabled })}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {s.enabled ? 'Switch off' : 'Switch on'}
          </button>
          {s.enabled ? (
            <button
              type="button"
              disabled={call.isPending}
              onClick={() => save({ testers_only: !s.testers_only })}
              className="rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {s.testers_only ? 'Open to everyone' : 'Back to testers only'}
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm">
          Minutes used this month: <span className="font-semibold">{used.toLocaleString()}</span> of {s.monthly_minutes.toLocaleString()}
          <span className="block text-[13px] text-muted-foreground">
            One person in a room for one minute counts as one. When the month's minutes are used up, nobody can start a room
            until next month, so the live service's free plan is never passed.
          </span>
        </p>
        <Limits settings={s} busy={call.isPending} onSave={save} />
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">Testers</h2>
        <p className="mt-1 text-sm text-muted-foreground">While Live is for testers only, these members can join and (if they qualify) host.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {testers.map((t) => (
            <li key={t.user_id} className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
              {t.name}
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                onClick={() => call.mutate({ fn: 'admin_live_tester', args: { _user_id: t.user_id, _on: false } })}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {!testers.length ? <li className="text-sm text-muted-foreground">No testers yet.</li> : null}
        </ul>
        <MemberPicker
          label="Add a tester"
          onPick={(id) => call.mutate({ fn: 'admin_live_tester', args: { _user_id: id, _on: true } })}
        />
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">Reports waiting ({reports.length})</h2>
        {reports.length ? (
          <ul className="mt-3 divide-y rounded-xl border">
            {reports.map((r) => (
              <li key={r.id} className="space-y-1 p-3 text-sm">
                <p>
                  <span className="font-medium">{r.reporter}</span> reported {r.reported ? <span className="font-medium">{r.reported}</span> : 'the room'} in “
                  {r.room_title}” · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
                <p className="text-muted-foreground">{r.reason}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => call.mutate({ fn: 'admin_live_close_reports', args: { _room_id: r.room_id } })}
                    className="rounded-lg border px-2.5 py-1 text-[13px]"
                  >
                    Mark this room's reports done
                  </button>
                  {r.reported_user_id ? (
                    <button
                      type="button"
                      onClick={() =>
                        call.mutate({ fn: 'admin_live_stop_host', args: { _user_id: r.reported_user_id, _on: true, _reason: r.reason } })
                      }
                      className="rounded-lg border px-2.5 py-1 text-[13px] text-rose-600"
                    >
                      Stop {r.reported} from hosting
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No reports waiting.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">Rooms (last 14 days)</h2>
        {rooms.length ? (
          <ul className="mt-3 divide-y rounded-xl border">
            {rooms.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.host_name} · {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })} · {r.minutes} min used · most at once{' '}
                    {r.peak_listeners}
                    {r.open_reports ? ` · ${r.open_reports} report${r.open_reports === 1 ? '' : 's'}` : ''}
                  </span>
                </span>
                {r.status === 'live' ? (
                  <>
                    <Link to={`/live/${r.id}`} className="font-medium text-primary hover:underline">
                      Open
                    </Link>
                    <button
                      type="button"
                      disabled={endRoom.isPending}
                      onClick={() => endRoom.mutate(r.id)}
                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-[13px] font-semibold text-white"
                    >
                      End
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Ended</span>
                )}
                <button
                  type="button"
                  onClick={() => call.mutate({ fn: 'admin_live_stop_host', args: { _user_id: r.host_id, _on: true, _reason: `Room: ${r.title}` } })}
                  className="text-[13px] text-rose-600 hover:underline"
                >
                  Stop host
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No rooms yet.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold">Stopped from hosting</h2>
        {stopped_hosts.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {stopped_hosts.map((b) => (
              <li key={b.user_id} className="flex items-center justify-between gap-2">
                <span>
                  {b.name}
                  {b.reason ? <span className="text-muted-foreground"> · {b.reason}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => call.mutate({ fn: 'admin_live_stop_host', args: { _user_id: b.user_id, _on: false, _reason: null } })}
                  className="text-[13px] font-medium text-primary hover:underline"
                >
                  Allow again
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nobody.</p>
        )}
      </section>
    </div>
  )
}

function Limits({
  settings,
  busy,
  onSave,
}: {
  settings: Overview['settings']
  busy: boolean
  onSave: (patch: Partial<Overview['settings']>) => void
}) {
  const [v, setV] = useState({
    max_rooms_at_once: settings.max_rooms_at_once,
    room_minutes: settings.room_minutes,
    max_listeners: settings.max_listeners,
    monthly_minutes: settings.monthly_minutes,
  })
  const fields: { key: keyof typeof v; label: string }[] = [
    { key: 'max_rooms_at_once', label: 'Rooms at the same time' },
    { key: 'room_minutes', label: 'Minutes per room' },
    { key: 'max_listeners', label: 'Listeners per room' },
    { key: 'monthly_minutes', label: 'Minutes per month' },
  ]
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(v)
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className="text-sm">
          <span className="font-medium">{f.label}</span>
          <Input
            type="number"
            min={1}
            value={v[f.key]}
            onChange={(e) => setV({ ...v, [f.key]: Number(e.target.value) })}
            className="mt-1"
          />
        </label>
      ))}
      <button type="submit" disabled={busy} className="h-10 rounded-xl border text-sm font-medium sm:col-span-2 disabled:opacity-50">
        Save limits
      </button>
    </form>
  )
}

function MemberPicker({ label, onPick }: { label: string; onPick: (userId: string) => void }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<{ user_id: string; display_name: string; username: string }[]>([])
  const [busy, setBusy] = useState(false)
  const search = async () => {
    if (text.trim().length < 2) return
    setBusy(true)
    const { data } = await supabase.rpc('admin_find_members', { _q: text.trim() })
    setResults((data ?? []) as typeof results)
    setBusy(false)
  }
  return (
    <div className="mt-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${label}: name or username`} />
        <button type="submit" className="h-10 shrink-0 rounded-xl border px-3 text-sm font-medium">
          {busy ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
        </button>
      </form>
      {results.length ? (
        <ul className="mt-2 divide-y rounded-xl border">
          {results.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <span>
                {m.display_name || m.username}
                {m.username ? <span className="text-muted-foreground"> @{m.username}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => {
                  onPick(m.user_id)
                  setResults([])
                  setText('')
                }}
                className="font-medium text-primary hover:underline"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

interface ServiceStatus {
  url: string
  api_key: string
  secret_preview: string
  updated_at: string
}

/**
 * The live service (LiveKit) connection: project URL, API key and secret, from
 * the LiveKit dashboard (Settings -> General and Settings -> API keys). The
 * secret goes into the database's locked store and is never shown again.
 */
function LiveServiceKeys() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['admin-live-service'],
    queryFn: async () => {
      const { data, error } = await sb.rpc('admin_live_service_status')
      if (error) return undefined
      return (data ?? null) as ServiceStatus | null
    },
  })
  const saved = q.data ?? null
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc('admin_set_live_service', { _url: url, _api_key: key, _secret: secret })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setSecret('')
      setEditing(false)
      toast.success('Live service saved')
      qc.invalidateQueries({ queryKey: ['admin-live-service'] })
    },
    onError: (e: Error) => toast.error('Could not save', { description: e.message }),
  })
  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc('admin_clear_live_service')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Live service keys removed')
      qc.invalidateQueries({ queryKey: ['admin-live-service'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Not applied yet: the Live rooms section below already explains.
  if (q.data === undefined && !q.isLoading) return null

  const startEditing = () => {
    setUrl(saved?.url ?? '')
    setKey(saved?.api_key ?? '')
    setSecret('')
    setEditing(true)
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-bold">Live service (LiveKit)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        From your LiveKit Cloud project: the Project URL is under Settings → General, the API key and secret under Settings →
        API keys. LiveKit shows a secret only once, when the key is made; if you no longer have it, make a new key there.
      </p>
      {saved && !editing ? (
        <div className="mt-3 space-y-1.5 text-sm">
          <p>
            Project URL: <code className="rounded bg-muted px-1.5 py-0.5">{saved.url}</code>
          </p>
          <p>
            API key: <code className="rounded bg-muted px-1.5 py-0.5">{saved.api_key}</code>
          </p>
          <p>
            API secret: <code className="rounded bg-muted px-1.5 py-0.5" aria-label="API secret (hidden)">{saved.secret_preview}</code>
          </p>
          <p className="text-[12px] text-muted-foreground">Saved {format(new Date(saved.updated_at), 'dd MMM yyyy HH:mm')}</p>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={startEditing} className="rounded-xl border px-3 py-1.5 text-sm font-medium">
              Change
            </button>
            <button
              type="button"
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
              className="rounded-xl px-3 py-1.5 text-sm text-rose-600 hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ) : saved || editing || q.data === null ? (
        <form
          className="mt-3 space-y-3"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">Project URL</span>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="abiaconnect-xxxx.livekit.cloud"
              autoComplete="off"
              spellCheck={false}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">API key</span>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="APIxxxxxxxx"
              autoComplete="off"
              spellCheck={false}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">API secret</span>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={saved ? 'Leave empty to keep the saved secret' : 'Paste the secret'}
              autoComplete="new-password"
              spellCheck={false}
              className="mt-1"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending || !url.trim() || !key.trim() || (!saved && !secret.trim())}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
            </button>
            {saved ? (
              <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-xl border px-4 text-sm">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="mt-3 h-10 animate-pulse rounded-xl bg-muted" />
      )}
    </section>
  )
}
