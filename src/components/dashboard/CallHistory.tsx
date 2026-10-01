import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'

interface CallRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  conversations: { user1_id: string; user2_id: string } | null
}

interface PeerProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type CallOutcome = 'answered' | 'missed' | 'declined'

interface CallEntry {
  id: string
  peerId: string
  peer?: PeerProfile
  direction: 'incoming' | 'outgoing'
  outcome: CallOutcome
  durationSec: number
  reason: string | null
  createdAt: string
  conversationId: string
}

/** Parse the `[call:*]` marker stored in messages when a call ends. */
function parseCallMessage(content: string): { kind: 'ended' | 'missed'; duration: number; reason: string | null } | null {
  const m = content.match(/^\[call:(ended|missed)(?::video)?\]\s*(.*)$/)
  if (!m) return null
  const kind = m[1] as 'ended' | 'missed'
  const rest = (m[2] || '').trim()
  if (kind === 'ended') {
    const d = rest.match(/^(\d+)s/)
    return { kind, duration: d ? parseInt(d[1], 10) : 0, reason: null }
  }
  return { kind, duration: 0, reason: rest || null }
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

export default function CallHistory() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const callsQ = useQuery({
    queryKey: ['call-history', userId],
    enabled: !!userId,
    queryFn: async (): Promise<CallEntry[]> => {
      // Only the caller writes the `[call:*]` marker (see webrtcCall.endCall),
      // but the message lives inside the shared conversation so both peers
      // can read it under existing RLS.
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, conversations!inner(user1_id, user2_id)')
        .like('content', '[call:%')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error

      const rows = (data ?? []) as unknown as CallRow[]
      const entries: CallEntry[] = []
      for (const r of rows) {
        const parsed = parseCallMessage(r.content || '')
        if (!parsed) continue
        const convo = r.conversations
        if (!convo) continue
        const peerId = convo.user1_id === userId ? convo.user2_id : convo.user1_id
        // Direction is from the current user's perspective. The caller is
        // always the sender of the marker message.
        const iWasCaller = r.sender_id === userId
        const direction: 'incoming' | 'outgoing' = iWasCaller ? 'outgoing' : 'incoming'
        let outcome: CallOutcome
        if (parsed.kind === 'ended') {
          outcome = 'answered'
        } else {
          const reason = (parsed.reason || '').toLowerCase()
          outcome = reason.includes('reject') || reason.includes('declin') ? 'declined' : 'missed'
        }
        entries.push({
          id: r.id,
          peerId,
          direction,
          outcome,
          durationSec: parsed.duration,
          reason: parsed.reason,
          createdAt: r.created_at,
          conversationId: r.conversation_id,
        })
      }
      return entries
    },
  })

  const peerIds = useMemo(() => Array.from(new Set((callsQ.data ?? []).map((c) => c.peerId))), [callsQ.data])

  const profilesQ = useQuery({
    queryKey: ['call-history-profiles', peerIds],
    enabled: peerIds.length > 0,
    queryFn: async (): Promise<Record<string, PeerProfile>> => {
      const { data, error } = await supabase.rpc('get_public_profiles', { _ids: peerIds })
      if (error) throw error
      const map: Record<string, PeerProfile> = {}
      for (const p of (data ?? []) as PeerProfile[]) map[p.id] = p
      return map
    },
  })

  const entries = (callsQ.data ?? []).map((c) => ({ ...c, peer: profilesQ.data?.[c.peerId] }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-white">Call history</h2>
        <p className="mt-1 text-sm text-slate-300/68">Your last 100 voice calls, with who called and whether it was answered.</p>
      </div>

      {callsQ.isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300/70">Loading call history…</div>
      ) : callsQ.error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-6 text-sm text-rose-100">
          Could not load call history.
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Phone className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-white">No calls yet</p>
          <p className="mt-1 text-xs text-slate-300/68">When you place or receive a voice call, it will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {entries.map((c) => {
            const name = c.peer?.display_name || c.peer?.username || 'Unknown user'
            const meta = outcomeMeta(c.outcome, c.direction)
            return (
              <li key={c.id} className="flex items-center gap-3 p-3 sm:p-4">
                <UserAvatar avatarUrl={c.peer?.avatar_url ?? null} displayName={name} size="md" className="h-11 w-11 border border-white/10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.badgeClass}`}>
                      <meta.Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-300/68">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    {c.outcome === 'answered' && c.durationSec > 0 ? ` · ${formatDuration(c.durationSec)}` : ''}
                    {c.outcome !== 'answered' && c.reason ? ` · ${c.reason}` : ''}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary" className="rounded-xl">
                  <Link to={`/messages/${c.conversationId}`}>Open</Link>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function outcomeMeta(outcome: CallOutcome, direction: 'incoming' | 'outgoing') {
  if (outcome === 'answered') {
    return direction === 'incoming'
      ? { label: 'Incoming', Icon: PhoneIncoming, badgeClass: 'bg-emerald-500/15 text-emerald-300' }
      : { label: 'Outgoing', Icon: PhoneOutgoing, badgeClass: 'bg-emerald-500/15 text-emerald-300' }
  }
  if (outcome === 'declined') {
    return { label: 'Declined', Icon: PhoneOff, badgeClass: 'bg-amber-500/15 text-amber-300' }
  }
  return direction === 'incoming'
    ? { label: 'Missed', Icon: PhoneMissed, badgeClass: 'bg-rose-500/15 text-rose-300' }
    : { label: 'No answer', Icon: PhoneMissed, badgeClass: 'bg-rose-500/15 text-rose-300' }
}
