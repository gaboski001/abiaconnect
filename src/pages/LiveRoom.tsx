import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DisconnectReason, Room, RoomEvent, Track, type Participant } from 'livekit-client'
import { Flag, Hand, Loader2, LogOut, Mic, MicOff, Pin, Send, Trash2, Volume2, X } from 'lucide-react'
import { SEO } from '@/components/SEO'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  getLiveRoom,
  listLiveComments,
  liveAction,
  liveHeartbeat,
  moderateLiveComment,
  postLiveComment,
  raiseHand,
  reportLive,
  useLiveStatus,
  type LivePerson,
  type LiveRole,
} from '@/lib/live'
import { LIVE_ROOM_RULES } from '@/pages/LiveRooms'

type Connection = 'connecting' | 'connected' | 'failed' | 'left'

const ROLE_LABEL: Record<LiveRole, string> = { host: 'Host', moderator: 'Moderator', speaker: 'Speaker', listener: 'Listener' }

export default function LiveRoom() {
  const { roomId = '' } = useParams()
  const { user, loading } = useAuth()
  const status = useLiveStatus()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const detail = useQuery({ queryKey: ['live-room', roomId], queryFn: () => getLiveRoom(roomId), enabled: !!user })
  const comments = useQuery({ queryKey: ['live-comments', roomId], queryFn: () => listLiveComments(roomId), enabled: !!user })

  const roomRef = useRef<Room | null>(null)
  const audioRef = useRef<HTMLDivElement>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const [failure, setFailure] = useState('')
  const [needsTap, setNeedsTap] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [talking, setTalking] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<LivePerson | null>(null)
  const [reporting, setReporting] = useState<{ userId: string | null; name: string } | null>(null)

  const room = detail.data
  const myRole = room?.my_role ?? null
  const live = room?.status === 'live'

  // Join the live audio once, when the room is open.
  useEffect(() => {
    if (!user || !live) return
    let cancelled = false
    const lk = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = lk
    const syncMic = () => setMicOn(lk.localParticipant.isMicrophoneEnabled)
    lk.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return
      const el = track.attach()
      audioRef.current?.appendChild(el)
    })
    lk.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()))
    lk.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsTap(!lk.canPlaybackAudio))
    lk.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => setTalking(new Set(speakers.map((s) => s.identity))))
    lk.on(RoomEvent.LocalTrackPublished, syncMic)
    lk.on(RoomEvent.LocalTrackUnpublished, syncMic)
    lk.on(RoomEvent.TrackMuted, syncMic)
    lk.on(RoomEvent.TrackUnmuted, syncMic)
    lk.on(RoomEvent.ParticipantPermissionsChanged, syncMic)
    lk.on(RoomEvent.Disconnected, (reason) => {
      if (cancelled) return
      setConnection('left')
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) toast.error('You were removed from this room.')
      if (reason === DisconnectReason.ROOM_DELETED) qc.invalidateQueries({ queryKey: ['live-room', roomId] })
    })
    ;(async () => {
      try {
        const pass = await liveAction<{ url: string; token: string }>({ action: 'join', room_id: roomId })
        if (cancelled) return
        await lk.connect(pass.url, pass.token)
        if (cancelled) return lk.disconnect()
        setConnection('connected')
        setNeedsTap(!lk.canPlaybackAudio)
        qc.invalidateQueries({ queryKey: ['live-room', roomId] })
      } catch (e) {
        if (cancelled) return
        setConnection('failed')
        setFailure((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
      roomRef.current = null
      lk.disconnect()
    }
  }, [user, live, roomId, qc])

  // Changes to the people and comments show up straight away.
  useEffect(() => {
    if (!user || !roomId) return
    const channel = supabase
      .channel(`live-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_room_people', filter: `room_id=eq.${roomId}` }, () =>
        qc.invalidateQueries({ queryKey: ['live-room', roomId] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_room_comments', filter: `room_id=eq.${roomId}` }, () =>
        qc.invalidateQueries({ queryKey: ['live-comments', roomId] }),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_rooms', filter: `id=eq.${roomId}` }, () =>
        qc.invalidateQueries({ queryKey: ['live-room', roomId] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, roomId, qc])

  // Tell the server we are still here every minute; it keeps the room open
  // while the host is in it and counts the minutes towards the free amount.
  useEffect(() => {
    if (connection !== 'connected') return
    const beat = async () => {
      try {
        const r = await liveHeartbeat(roomId)
        if (r.status === 'ended' || r.removed) {
          roomRef.current?.disconnect()
          qc.invalidateQueries({ queryKey: ['live-room', roomId] })
        }
      } catch {
        /* try again next minute */
      }
    }
    const t = window.setInterval(beat, 60_000)
    return () => window.clearInterval(t)
  }, [connection, roomId, qc])

  // Off the stage: make sure the microphone is off.
  useEffect(() => {
    if (myRole === 'listener' && roomRef.current?.localParticipant.isMicrophoneEnabled) {
      roomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {})
    }
  }, [myRole])

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => liveAction({ room_id: roomId, ...body }),
    onSuccess: () => {
      setPicked(null)
      qc.invalidateQueries({ queryKey: ['live-room', roomId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!loading && !user) return <Navigate to="/login" replace />
  if (status.isFetched && !status.data?.allowed) return <Navigate to="/" replace />
  if (detail.isLoading) return <div className="mx-auto mt-8 h-40 max-w-3xl animate-pulse rounded-2xl bg-muted" />
  if (!room) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border p-6 text-center">
        <p className="font-semibold">This room could not be found.</p>
        <Link to="/live" className="mt-3 inline-block font-medium text-primary">
          See live rooms
        </Link>
      </div>
    )
  }

  if (!live) return <RoomEnded title={room.title} peak={room.peak_listeners} hostId={room.host_id} isHost={room.host_id === user?.id} startedAt={room.started_at} endedAt={room.ended_at} />

  const people = room.people
  const stage = people.filter((p) => p.role !== 'listener')
  const listeners = people.filter((p) => p.role === 'listener')
  const hands = listeners.filter((p) => p.hand_raised)
  const me = people.find((p) => p.user_id === user?.id)
  const runsRoom = myRole === 'host' || myRole === 'moderator'
  const onStage = myRole === 'host' || myRole === 'moderator' || myRole === 'speaker'

  const toggleMic = async () => {
    const lk = roomRef.current
    if (!lk) return
    try {
      await lk.localParticipant.setMicrophoneEnabled(!lk.localParticipant.isMicrophoneEnabled)
      setMicOn(lk.localParticipant.isMicrophoneEnabled)
    } catch {
      toast.error('Could not use your microphone. Please allow microphone access and try again.')
    }
  }

  const leave = () => {
    roomRef.current?.disconnect()
    navigate('/live')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-28">
      <SEO title={room.title} description="A live audio room on AbiaConnect." path={`/live/${room.id}`} />
      <div ref={audioRef} className="hidden" />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase text-rose-600">
            <span className="size-2 animate-pulse rounded-full bg-rose-600" /> Live{room.group_name ? ` · ${room.group_name}` : ''}
          </p>
          <h1 className="text-xl font-bold">{room.title}</h1>
        </div>
        <button
          type="button"
          onClick={() => setReporting({ userId: null, name: 'this room' })}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[13px]"
        >
          <Flag className="size-3.5" /> Report
        </button>
      </header>

      {connection === 'connecting' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Joining the room…
        </p>
      ) : connection === 'failed' ? (
        <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{failure}</p>
      ) : connection === 'left' ? (
        <p className="rounded-xl bg-muted p-3 text-sm">You have left the live audio.</p>
      ) : null}

      {needsTap && connection === 'connected' ? (
        <button
          type="button"
          onClick={() => roomRef.current?.startAudio().then(() => setNeedsTap(false))}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 font-semibold text-primary-foreground"
        >
          <Volume2 className="size-4" /> Tap to hear the room
        </button>
      ) : null}

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">On stage</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {stage.map((p) => (
            <PersonTile key={p.user_id} person={p} talking={talking.has(p.user_id)} onPick={() => setPicked(p)} />
          ))}
        </ul>
      </section>

      {runsRoom && hands.length ? (
        <section className="rounded-2xl border bg-card p-3">
          <h2 className="text-[13px] font-semibold">Asking to speak ({hands.length})</h2>
          <ul className="mt-2 space-y-2">
            {hands.map((p) => (
              <li key={p.user_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">✋ {p.name}</span>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: 'set_role', user_id: p.user_id, role: 'speaker' })}
                    className="rounded-lg bg-primary px-2.5 py-1 text-[13px] font-semibold text-primary-foreground"
                  >
                    Invite up
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">Listening ({listeners.length})</h2>
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {listeners.map((p) => (
            <PersonTile key={p.user_id} person={p} small onPick={() => setPicked(p)} />
          ))}
        </ul>
      </section>

      <Comments roomId={roomId} canModerate={runsRoom} items={comments.data ?? []} inRoom={!!me} />

      <details className="rounded-xl border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Room rules</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
          {LIVE_ROOM_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      {/* Controls stay at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <button type="button" onClick={leave} className="inline-flex h-11 items-center gap-1.5 rounded-xl border px-3 font-medium">
            <LogOut className="size-4" /> Leave
          </button>
          {onStage ? (
            <button
              type="button"
              disabled={connection !== 'connected'}
              onClick={toggleMic}
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50',
                micOn ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />} {micOn ? 'Mic on' : 'Mic off'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!me}
              onClick={() =>
                raiseHand(roomId, !me?.hand_raised)
                  .then(() => qc.invalidateQueries({ queryKey: ['live-room', roomId] }))
                  .catch((e: Error) => toast.error(e.message))
              }
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50',
                me?.hand_raised ? 'bg-amber-400 text-black' : 'bg-muted',
              )}
            >
              <Hand className="size-4" /> {me?.hand_raised ? 'Hand raised' : 'Raise hand to speak'}
            </button>
          )}
          {myRole === 'host' ? (
            <button
              type="button"
              disabled={act.isPending}
              onClick={() => act.mutate({ action: 'end' })}
              className="h-11 rounded-xl bg-rose-600 px-3 font-semibold text-white"
            >
              End room
            </button>
          ) : null}
        </div>
      </div>

      {picked ? (
        <PersonSheet
          person={picked}
          myRole={myRole}
          isMe={picked.user_id === user?.id}
          busy={act.isPending}
          onClose={() => setPicked(null)}
          onAction={(body) => act.mutate(body)}
          onReport={() => {
            setReporting({ userId: picked.user_id, name: picked.name })
            setPicked(null)
          }}
        />
      ) : null}
      {reporting ? <ReportSheet roomId={roomId} target={reporting} onClose={() => setReporting(null)} /> : null}
    </div>
  )
}

function Avatar({ person, size }: { person: LivePerson; size: string }) {
  return person.avatar ? (
    <img src={person.avatar} alt="" className={cn(size, 'rounded-full object-cover')} />
  ) : (
    <span className={cn(size, 'flex items-center justify-center rounded-full bg-primary/10 font-semibold text-primary')}>
      {person.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function PersonTile({ person, talking, small, onPick }: { person: LivePerson; talking?: boolean; small?: boolean; onPick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPick} className="flex w-full flex-col items-center gap-1 text-center">
        <span className={cn('rounded-full p-0.5', talking ? 'ring-2 ring-emerald-500' : 'ring-2 ring-transparent')}>
          <Avatar person={person} size={small ? 'size-11' : 'size-16'} />
        </span>
        <span className="w-full truncate text-[12px] font-medium">{person.name}</span>
        {!small ? <span className="text-[11px] text-muted-foreground">{ROLE_LABEL[person.role]}</span> : null}
      </button>
    </li>
  )
}

function PersonSheet({
  person,
  myRole,
  isMe,
  busy,
  onClose,
  onAction,
  onReport,
}: {
  person: LivePerson
  myRole: LiveRole | null
  isMe: boolean
  busy: boolean
  onClose: () => void
  onAction: (body: Record<string, unknown>) => void
  onReport: () => void
}) {
  const host = myRole === 'host'
  const mod = myRole === 'moderator'
  // Moderators cannot act on the host or on other moderators.
  const canManage = !isMe && person.role !== 'host' && (host || (mod && person.role !== 'moderator'))
  const set = (role: LiveRole) => onAction({ action: 'set_role', user_id: person.user_id, role })
  const btn = 'w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm space-y-2 rounded-t-2xl bg-background p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Avatar person={person} size="size-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{person.name}</p>
            <p className="text-[13px] text-muted-foreground">{ROLE_LABEL[person.role]}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5">
            <X className="size-5" />
          </button>
        </div>
        <Link to={`/member/${person.user_id}`} className={cn(btn, 'block')}>
          View profile
        </Link>
        {canManage && person.role === 'listener' ? (
          <button type="button" disabled={busy} className={btn} onClick={() => set('speaker')}>
            Invite to speak
          </button>
        ) : null}
        {canManage && person.role === 'speaker' ? (
          <button type="button" disabled={busy} className={btn} onClick={() => set('listener')}>
            Move back to listeners
          </button>
        ) : null}
        {host && !isMe && person.role !== 'moderator' && person.role !== 'host' ? (
          <button type="button" disabled={busy} className={btn} onClick={() => set('moderator')}>
            Make moderator
          </button>
        ) : null}
        {host && person.role === 'moderator' ? (
          <button type="button" disabled={busy} className={btn} onClick={() => set('speaker')}>
            Stop being moderator
          </button>
        ) : null}
        {canManage && person.role !== 'listener' ? (
          <button type="button" disabled={busy} className={btn} onClick={() => onAction({ action: 'mute', user_id: person.user_id })}>
            Mute their mic
          </button>
        ) : null}
        {canManage ? (
          <button
            type="button"
            disabled={busy}
            className={cn(btn, 'text-rose-600')}
            onClick={() => onAction({ action: 'remove', user_id: person.user_id })}
          >
            Remove from room
          </button>
        ) : null}
        {host && canManage ? (
          <button
            type="button"
            disabled={busy}
            className={cn(btn, 'text-rose-600')}
            onClick={() => onAction({ action: 'remove', user_id: person.user_id, block: true })}
          >
            Remove and keep out of my rooms
          </button>
        ) : null}
        {!isMe ? (
          <button type="button" className={btn} onClick={onReport}>
            Report {person.name}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ReportSheet({ roomId, target, onClose }: { roomId: string; target: { userId: string | null; name: string }; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const send = useMutation({
    mutationFn: () => reportLive(roomId, target.userId, reason.trim()),
    onSuccess: () => {
      toast.success('Thank you. Our team will look at this.')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <form
        className="w-full max-w-sm space-y-3 rounded-t-2xl bg-background p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          send.mutate()
        }}
      >
        <p className="font-semibold">Report {target.name}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="What happened?"
          className="w-full rounded-xl border bg-background p-3 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!reason.trim() || send.isPending}
            className="h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
          >
            Send report
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border px-4">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Comments({
  roomId,
  canModerate,
  items,
  inRoom,
}: {
  roomId: string
  canModerate: boolean
  items: Awaited<ReturnType<typeof listLiveComments>>
  inRoom: boolean
}) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const send = useMutation({
    mutationFn: () => postLiveComment(roomId, text.trim()),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['live-comments', roomId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const moderate = (id: string, action: 'pin' | 'unpin' | 'delete') =>
    moderateLiveComment(id, action)
      .then(() => qc.invalidateQueries({ queryKey: ['live-comments', roomId] }))
      .catch((e: Error) => toast.error(e.message))
  const pinned = items.find((c) => c.is_pinned)

  return (
    <section className="rounded-2xl border bg-card p-3">
      <h2 className="text-[13px] font-semibold">Comments</h2>
      {pinned ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/10 p-2 text-sm">
          <Pin className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-semibold">{pinned.name}: </span>
            {pinned.body}
          </span>
        </p>
      ) : null}
      <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto text-sm">
        {items.map((c) => (
          <li key={c.id} className="group flex items-start gap-2">
            <span className="min-w-0 flex-1 break-words">
              <span className="font-semibold">{c.name}: </span>
              {c.body}
            </span>
            {canModerate ? (
              <span className="flex shrink-0 gap-1">
                <button type="button" aria-label={c.is_pinned ? 'Unpin' : 'Pin'} onClick={() => moderate(c.id, c.is_pinned ? 'unpin' : 'pin')}>
                  <Pin className={cn('size-3.5', c.is_pinned ? 'text-primary' : 'text-muted-foreground')} />
                </button>
                <button type="button" aria-label="Delete" onClick={() => moderate(c.id, 'delete')}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </button>
              </span>
            ) : null}
          </li>
        ))}
        {!items.length ? <li className="text-muted-foreground">No comments yet.</li> : null}
      </ul>
      {inRoom ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) send.mutate()
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder="Say something…"
            className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm"
          />
          <button type="submit" aria-label="Send" disabled={send.isPending} className="h-10 rounded-xl bg-primary px-3 text-primary-foreground">
            <Send className="size-4" />
          </button>
        </form>
      ) : null}
    </section>
  )
}

function RoomEnded({
  title,
  peak,
  hostId,
  isHost,
  startedAt,
  endedAt,
}: {
  title: string
  peak: number
  hostId: string
  isHost: boolean
  startedAt: string
  endedAt: string | null
}) {
  const minutes = endedAt ? Math.max(1, Math.round((+new Date(endedAt) - +new Date(startedAt)) / 60_000)) : null
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-card p-6 text-center">
      <p className="text-[12px] font-bold uppercase text-muted-foreground">Room ended</p>
      <h1 className="text-xl font-bold">{title}</h1>
      {isHost ? (
        <p className="text-sm text-muted-foreground">
          {minutes ? `Live for ${minutes} minute${minutes === 1 ? '' : 's'}. ` : ''}Most listeners at once: {peak}.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Thanks for listening.</p>
      )}
      <div className="flex justify-center gap-2">
        {!isHost ? (
          <Link to={`/member/${hostId}`} className="rounded-xl border px-4 py-2 text-sm font-medium">
            See the host
          </Link>
        ) : null}
        <Link to="/live" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          More live rooms
        </Link>
      </div>
    </div>
  )
}
