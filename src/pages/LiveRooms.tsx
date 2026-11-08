import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNowStrict } from 'date-fns'
import { Headphones, Loader2, Mic, Radio, Users } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { startLiveRoom, useLiveRooms, useLiveStatus, liveReason, type LiveRoomSummary } from '@/lib/live'

export const LIVE_ROOM_RULES = [
  'Be respectful. The community rules apply here too.',
  'No political campaigning, no selling, and no phone numbers in comments.',
  'Rooms are not recorded.',
  'Hosts and moderators can remove anyone who breaks these rules.',
]

export default function LiveRooms() {
  const { user, loading } = useAuth()
  const status = useLiveStatus()
  const allowed = status.data?.allowed === true
  const rooms = useLiveRooms(allowed)
  const [form, setForm] = useState(false)

  if (!loading && !user) return <Navigate to="/login" replace />
  if (status.isFetched && !allowed) return <Navigate to="/" replace />

  const canHost = allowed && !status.data?.host_blocker
  const list = rooms.data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SEO title="Live rooms" description="Listen in to live audio rooms from Abia groups." path="/live" />
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold native:hidden">Live rooms</h1>
          <p className="text-sm text-muted-foreground">Listen in, raise your hand to speak, and chat with members live.</p>
        </div>
        {canHost && !form ? (
          <button
            type="button"
            onClick={() => setForm(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground"
          >
            <Radio className="size-4" /> Go live
          </button>
        ) : null}
      </header>

      {form && status.data ? <GoLiveForm groups={status.data.groups} minutes={status.data.room_minutes} onCancel={() => setForm(false)} /> : null}

      {rooms.isLoading || status.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <Headphones className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">No one is live right now</p>
          <p className="mt-1 text-sm text-muted-foreground">When a member goes live, their room shows here.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => (
            <li key={r.id}>
              <LiveRoomCard room={r} />
            </li>
          ))}
        </ul>
      )}

      {allowed && status.data?.host_blocker && status.data.host_blocker !== 'stopped' ? (
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">Want to host your own room?</h2>
          <p className="mt-1 text-muted-foreground">{liveReason(status.data.host_blocker)}</p>
          <p className="mt-2 text-muted-foreground">
            Hosts are members at Level 5 (Influencer) or on Premium or VIP, who run a group that is active.{' '}
            <Link to="/rewards" className="font-medium text-primary hover:underline">
              See your level
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  )
}

export function LiveRoomCard({ room }: { room: LiveRoomSummary }) {
  return (
    <Link to={`/live/${room.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 active:bg-muted">
      <span className="relative shrink-0">
        {room.host_avatar ? (
          <img src={room.host_avatar} alt="" className="size-12 rounded-full object-cover" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
            {room.host_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold uppercase text-white">
          Live
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{room.title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {room.host_name}
          {room.group_name ? ` · ${room.group_name}` : ''}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
          <Users className="size-3.5" /> {room.listening} in the room · started {formatDistanceToNowStrict(new Date(room.started_at))} ago
        </span>
      </span>
    </Link>
  )
}

function GoLiveForm({ groups, minutes, onCancel }: { groups: { id: string; name: string }[]; minutes: number; onCancel: () => void }) {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [group, setGroup] = useState(groups[0]?.id ?? '')
  const [accepted, setAccepted] = useState(false)

  const start = useMutation({
    mutationFn: () => startLiveRoom(title.trim(), group || null),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['live-rooms'] })
      navigate(`/live/${id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start.mutate()
      }}
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Mic className="size-4" /> Go live (audio)
      </h2>
      <label className="block text-sm">
        <span className="font-medium">What will you talk about?</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="e.g. Ask me about studying at ABSU"
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Group</span>
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3">
          {isAdmin ? <option value="">All of AbiaConnect</option> : null}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-xl bg-muted/60 p-3 text-sm">
        <p className="font-medium">Room rules</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
          {LIVE_ROOM_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li>Your room ends after {minutes} minutes, or 5 minutes after you leave.</li>
        </ul>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4" />
        <span>I am 18 or older and I accept the room rules.</span>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!accepted || title.trim().length < 3 || start.isPending}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
        >
          {start.isPending ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />} Start
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-xl border px-4 font-medium">
          Cancel
        </button>
      </div>
    </form>
  )
}
