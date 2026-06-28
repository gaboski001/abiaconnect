import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import {
  ArrowLeft,
  MessageSquarePlus,
  Phone,
  Search,
  Send,
  Loader2,
  Paperclip,
  Smile,
  X,
  FileText,
  Download,
  Sparkles,
  ShieldCheck,
  PhoneIncoming,
  PhoneMissed,
  PhoneCall,
} from 'lucide-react'
import { VoiceRecorderButton, VoiceMessageBubble, isAudioAttachment } from '@/components/messages/VoiceRecorder'
import { callManager, useIsCallSupported } from '@/lib/webrtcCall'
import { SEO } from '@/components/SEO'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/ui/UserAvatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  compressImageToWebp,
  isImage,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_TTL_HOURS,
} from '@/lib/chatAttachments'
import { cn } from '@/lib/utils'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

import { uploadQueue } from '@/lib/uploadQueue'
import { useUploadQueue } from '@/hooks/useUploadQueue'

const EmojiPicker = lazy(() => import('emoji-picker-react'))


interface Profile {
  id: string
  display_name?: string | null
  username?: string | null
  avatar_url?: string | null
}

interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  updated_at: string
  other_user?: Profile | null
  last_message?: string | null
  last_message_at?: string | null
  unread_count?: number
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  created_at: string
  is_read?: boolean
  read_at?: string | null
  attachment_url?: string | null
  attachment_type?: string | null
  attachment_name?: string | null
  attachment_size?: number | null
  attachment_expires_at?: string | null
  _optimistic?: boolean
  _status?: 'sent' | 'delivered'
}


function Avatar({ profile, size = 'md' }: { profile?: Profile | null; size?: 'sm' | 'md' | 'lg' }) {
  const avatarSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'
  return (
    <UserAvatar
      avatarUrl={profile?.avatar_url}
      displayName={profile?.display_name || profile?.username || 'User'}
      size={avatarSize}
    />
  )
}

export default function Messages() {
  const { user } = useAuth()
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)

  const convosQ = useQuery({
    queryKey: ['conversations', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${user!.id},user2_id.eq.${user!.id}`)
        .order('updated_at', { ascending: false })
      if (error) throw error
      const list = (convos ?? []) as Conversation[]
      if (!list.length) return list

      const otherIds = list.map((c) => (c.user1_id === user!.id ? c.user2_id : c.user1_id))
      const ids = list.map((c) => c.id)
      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase.rpc('get_public_profiles', { _ids: otherIds }),
        supabase
          .from('messages')
          .select('conversation_id, sender_id, content, is_read, created_at')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false })
          .limit(600),
      ])
      const profileMap: Record<string, Profile> = {}
      ;(profiles ?? []).forEach((p: any) => (profileMap[p.id] = p))
      const lastMap: Record<string, { content: string; created_at: string }> = {}
      const unreadMap: Record<string, number> = {}
      ;(msgs ?? []).forEach((m: any) => {
        if (!lastMap[m.conversation_id]) {
          lastMap[m.conversation_id] = {
            content:
              typeof m.content === 'string' && m.content.startsWith('[call:missed]')
                ? '📞 Missed voice call'
                : m.content || '📎 Attachment',
            created_at: m.created_at,
          }
        }
        if (!m.is_read && m.sender_id !== user!.id) {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1
        }
      })
      return list.map((c) => {
        const otherId = c.user1_id === user!.id ? c.user2_id : c.user1_id
        return {
          ...c,
          other_user: profileMap[otherId] || { id: otherId },
          last_message: lastMap[c.id]?.content ?? null,
          last_message_at: lastMap[c.id]?.created_at ?? c.updated_at,
          unread_count: unreadMap[c.id] || 0,
        }
      })
    },
  })

  // Realtime: refresh conversation list on any new message
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`messages-inbox:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => qc.invalidateQueries({ queryKey: ['conversations', user.id] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, qc])

  const filteredConvos = useMemo(() => {
    const list = convosQ.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) =>
      (c.other_user?.display_name || c.other_user?.username || '').toLowerCase().includes(q),
    )
  }, [convosQ.data, search])

  const activeConvo = useMemo(
    () => filteredConvos.find((c) => c.id === conversationId) || (convosQ.data ?? []).find((c) => c.id === conversationId),
    [filteredConvos, convosQ.data, conversationId],
  )

  return (
    <>
      <SEO title="Your Messages" description="View and manage your private conversations on AbiaConnect." path="/messages" />
      <div className="relative mx-auto max-w-7xl">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 rounded-[2rem] blur-3xl opacity-50" style={{ background: 'radial-gradient(circle at 10% 20%, rgba(28,169,217,0.24), transparent 36%), radial-gradient(circle at 85% 10%, rgba(248,195,1,0.20), transparent 28%)' }} />

        <section className="mb-4 overflow-hidden rounded-[2rem] border border-white/10 bg-[#091220] p-5 text-white sm:p-6" style={{ boxShadow: PREMIUM_SHADOW }}>
          <div className="absolute" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200/80" style={{ background: GOLD_GRADIENT_SOFT }}>
                <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                AbiaConnect messages
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight">Stay connected across Abia</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300/76">
                Private, real-time conversations with fellow community members — share updates, coordinate on local issues, and place secure voice calls without leaving AbiaConnect.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/62">Realtime</p>
                <p className="mt-1 text-sm font-bold text-emerald-300">Connected</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/62">Calls</p>
                <p className="mt-1 text-sm font-bold text-slate-100">Push-ready</p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex h-[calc(100vh-14.5rem)] min-h-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(8,14,26,0.94)] text-white md:h-[calc(100vh-12.8rem)]" style={{ boxShadow: PREMIUM_SHADOW }}>
          <aside className={cn('w-full min-h-0 border-r border-white/10 bg-[rgba(7,12,22,0.92)] md:w-[22rem] md:min-w-[22rem] flex-col', conversationId ? 'hidden md:flex' : 'flex')}>
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white">Messages</h2>
                  <p className="mt-1 text-xs text-slate-400">Private conversations and voice calls</p>
                </div>
                <Dialog open={newOpen} onOpenChange={setNewOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" aria-label="New message" className="h-11 w-11 rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
                      <MessageSquarePlus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <NewMessageDialog onClose={() => setNewOpen(false)} />
                </Dialog>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className="h-12 rounded-2xl border-white/10 bg-white/[0.05] pl-9 text-white placeholder:text-slate-500" />
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {convosQ.isLoading ? (
                <div className="space-y-3 p-1">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-[1.3rem] bg-white/[0.05]" />)}
                </div>
              ) : filteredConvos.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-slate-300/70">No conversations yet.</div>
              ) : (
                filteredConvos.map((c) => {
                  const active = c.id === conversationId
                  return (
                    <Link
                      key={c.id}
                      to={`/messages/${c.id}`}
                      className={cn('flex items-start gap-3 rounded-[1.35rem] border px-3 py-3 transition', active ? 'border-[#F8C301]/20 bg-[rgba(248,195,1,0.08)]' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]')}
                    >
                      <Avatar profile={c.other_user} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-100">{c.other_user?.display_name || c.other_user?.username || 'User'}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">{c.last_message_at && formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-slate-400">{c.last_message || 'No messages yet'}</p>
                          {!!c.unread_count && <span className="min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>{c.unread_count}</span>}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </aside>

          <section className={cn('flex-1 min-h-0 flex-col bg-[rgba(5,10,18,0.96)]', conversationId ? 'flex' : 'hidden md:flex')}>
            {!conversationId ? (
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-sm rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-8">
                  <PhoneIncoming className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                  <p className="text-lg font-bold text-white">Select a conversation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Open a chat to send messages, share files, or start a premium voice call.</p>
                </div>
              </div>
            ) : (
              <ConversationView conversationId={conversationId} other={activeConvo?.other_user} onBack={() => navigate('/messages')} />
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function ConversationView({
  conversationId,
  other,
  onBack,
}: {
  conversationId: string
  other?: Profile | null
  onBack: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const queryKey = useMemo(() => ['messages', conversationId], [conversationId])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const readQueueRef = useRef<Set<string>>(new Set())
  const readFlushTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!pendingFile) {
      setFilePreview(null)
      return
    }
    if (isImage(pendingFile)) {
      const url = URL.createObjectURL(pendingFile)
      setFilePreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setFilePreview(null)
  }, [pendingFile])

  const messagesQ = useQuery({
    queryKey,
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(120)
      if (error) throw error
      return [...((data ?? []) as Message[])].reverse()
    },
  })

  // Realtime: merge INSERT/UPDATE directly into cache (no refetch, no duplicates)
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages-${conversationId}:${Date.now()}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          qc.setQueryData<Message[]>(queryKey, (prev) => {
            const list = prev ?? []
            if (list.some((m) => m.id === incoming.id)) return list
            // Reconcile: replace a matching optimistic temp row, else append.
            const tempIdx = list.findIndex(
              (m) =>
                m._optimistic &&
                m.sender_id === incoming.sender_id &&
                (m.content ?? '') === (incoming.content ?? ''),
            )
            const next = { ...incoming, _status: 'delivered' as const }
            if (tempIdx >= 0) {
              const copy = list.slice()
              copy[tempIdx] = next
              return copy
            }
            return [...list, next]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          qc.setQueryData<Message[]>(queryKey, (prev) =>
            (prev ?? []).map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          )
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, qc])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messagesQ.data?.length])

  // Viewport-based read receipts: mark each incoming message read only when it scrolls into view.
  const markedRef = useRef<Set<string>>(new Set())
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const registerMessageRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) messageRefs.current.set(id, el)
    else messageRefs.current.delete(id)
  }

  const flushReadReceipts = () => {
    if (!user) return
    const ids = Array.from(readQueueRef.current)
    readQueueRef.current.clear()
    readFlushTimerRef.current = null
    if (!ids.length) return

    const nowIso = new Date().toISOString()
    qc.setQueryData<Message[]>(queryKey, (prev) =>
      (prev ?? []).map((m) =>
        ids.includes(m.id) ? { ...m, is_read: true, read_at: m.read_at ?? nowIso } : m,
      ),
    )

    Promise.all(ids.map((id) => supabase.rpc('mark_message_read', { _message_id: id }))).then(() => {
      qc.invalidateQueries({ queryKey: ['conversations', user.id] })
      qc.invalidateQueries({ queryKey: ['messages-unread', user.id] })
    })
  }

  const queueReadReceipt = (id: string) => {
    readQueueRef.current.add(id)
    if (readFlushTimerRef.current !== null) return
    readFlushTimerRef.current = window.setTimeout(flushReadReceipts, 350)
  }

  useEffect(() => {
    return () => {
      if (readFlushTimerRef.current !== null) window.clearTimeout(readFlushTimerRef.current)
      readQueueRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!user || !messagesQ.data?.length) return
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = (entry.target as HTMLElement).dataset.mid
          if (!id || markedRef.current.has(id)) continue
          markedRef.current.add(id)
          observer.unobserve(entry.target)
          queueReadReceipt(id)
        }
      },
      { root, threshold: 0.6 },
    )
    for (const m of messagesQ.data) {
      if (m.sender_id === user.id || m.is_read || markedRef.current.has(m.id)) continue
      const el = messageRefs.current.get(m.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [messagesQ.data, user, qc, queryKey])
  


  const queueItems = useUploadQueue(conversationId)

  // Refresh inbox list when any queued upload completes
  useEffect(() => {
    if (queueItems.some((q) => q.status === 'done')) {
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
    }
  }, [queueItems, qc, user?.id])

  const handleFilePick = async (raw: File | null) => {
    if (!raw) return
    try {
      const processed = isImage(raw) ? await compressImageToWebp(raw) : raw
      if (processed.size > MAX_ATTACHMENT_BYTES) {
        toast.error('File too large. Maximum 2MB after compression.')
        return
      }
      setPendingFile(processed)
    } catch (e: any) {
      toast.error(e.message || 'Could not process file')
    }
  }

  const handleSend = (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    if ((!text && !pendingFile) || !user) return
    const file = pendingFile
    setDraft('')
    setPendingFile(null)
    if (fileRef.current) fileRef.current.value = ''

    // Text-only (incl. emoji): send instantly with optimistic update — no queue, no loading UI.
    if (!file && text) {
      const optimistic: Message = {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: conversationId,
        sender_id: user.id,
        content: text,
        created_at: new Date().toISOString(),
        is_read: false,
        _optimistic: true,
        _status: 'sent',
      }
      qc.setQueryData<Message[]>(queryKey, (prev) => [...(prev ?? []), optimistic])
      ;(async () => {
        const { error } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: text,
        })
        if (error) {
          qc.setQueryData<Message[]>(queryKey, (prev) =>
            (prev ?? []).filter((m) => m.id !== optimistic.id),
          )
          toast.error(error.message || 'Failed to send')
          setDraft((d) => d || text)
          return
        }
        supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
          .then(() => qc.invalidateQueries({ queryKey: ['conversations', user.id] }))
      })()
      return
    }

    uploadQueue.enqueue({
      conversationId,
      senderId: user.id,
      content: text,
      file,
    })
  }


  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    if (!el) {
      setDraft((d) => d + emoji)
      return
    }
    const start = el.selectionStart ?? draft.length
    const end = el.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  // Group messages by day
  const grouped = useMemo(() => {
    const groups: { date: string; items: Message[] }[] = []
    ;(messagesQ.data ?? []).forEach((m) => {
      const d = new Date(m.created_at)
      const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'PPP')
      const last = groups[groups.length - 1]
      if (last && last.date === key) last.items.push(m)
      else groups.push({ date: key, items: [m] })
    })
    return groups
  }, [messagesQ.data])

  const canSend = !!draft.trim() || !!pendingFile
  const callSupported = useIsCallSupported()

  return (
    <>
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-300 md:hidden hover:bg-white/[0.05]" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-1.5">
            <Avatar profile={other} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {other?.display_name || other?.username || 'Conversation'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              {other?.username ? <span className="truncate">@{other.username}</span> : null}
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
                <ShieldCheck className="size-3" /> Realtime ready
              </span>
            </div>
          </div>
          {other?.id && callSupported && (
            <Button
              size="icon"
              className="h-11 w-11 rounded-2xl text-slate-950"
              style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              onClick={() =>
                callManager
                  .startCall({
                    id: other.id,
                    name: other.display_name || other.username || 'User',
                    avatarUrl: other.avatar_url ?? null,
                    conversationId,
                  })
                  .catch((err) => toast.error(err?.message || 'Could not start call'))
              }
              aria-label="Voice call"
              title="Voice call"
            >
              <Phone className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(28,169,217,0.06),transparent_30%),linear-gradient(180deg,rgba(5,10,18,0.98)_0%,rgba(8,14,26,1)_100%)] p-4">
        {messagesQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">
            Say hi to start the conversation 👋
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.date} className="space-y-2">
              <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                {g.date}
              </div>
              {g.items.map((m) => {
                const mine = m.sender_id === user?.id
                const hasAudio =
                  m.attachment_url && isAudioAttachment(m.attachment_type)
                const hasImage =
                  m.attachment_url && !hasAudio && (m.attachment_type?.startsWith('image/') ?? false)
                const hasFile = m.attachment_url && !hasImage && !hasAudio
                const isMissedCall = typeof m.content === 'string' && m.content.startsWith('[call:missed]')
                if (isMissedCall) {
                  const reason = m.content!.replace('[call:missed]', '').trim() || 'No answer'
                  return (
                    <div key={m.id} data-mid={m.id} className="flex justify-center">
                      <div className="flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
                        <PhoneMissed className="h-3.5 w-3.5" />
                        <span>{mine ? 'Missed call' : 'Missed voice call'} · {reason}</span>
                        <span className="opacity-70">{format(new Date(m.created_at), 'p')}</span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div
                    key={m.id}
                    ref={!mine && !m.is_read ? registerMessageRef(m.id) : undefined}
                    data-mid={m.id}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm space-y-2',
                        mine
                          ? 'rounded-br-sm border border-[#F8C301]/15 bg-[linear-gradient(135deg,rgba(232,112,21,0.96)_0%,rgba(248,195,1,0.96)_100%)] text-slate-950 shadow-[0_16px_34px_-18px_rgba(248,195,1,0.5)]'
                          : 'rounded-bl-sm border border-white/10 bg-white/[0.06] text-slate-100',
                        m._optimistic && 'opacity-70',
                      )}
                    >
                      {hasAudio && (
                        <VoiceMessageBubble url={m.attachment_url!} mine={mine} />
                      )}
                      {hasImage && (
                        <a
                          href={m.attachment_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={m.attachment_url!}
                            alt={m.attachment_name || 'attachment'}
                            loading="lazy"
                            className="rounded-lg max-h-64 w-auto object-cover"
                          />
                        </a>
                      )}
                      {hasFile && (
                        <a
                          href={m.attachment_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={m.attachment_name || undefined}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
                            mine ? 'bg-secondary-foreground/10' : 'bg-background/60',
                          )}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1">
                            {m.attachment_name || 'Attachment'}
                          </span>
                          <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        </a>
                      )}
                      {m.content && (
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      )}
                      <p
                        className={cn(
                          'text-[10px] opacity-80',
                          mine ? 'text-right text-slate-800/85' : 'text-left text-slate-300/70',
                        )}
                      >
                        {format(new Date(m.created_at), 'p')}
                        {m.attachment_expires_at && (
                          <span className="ml-1">· expires in 48h</span>
                        )}
                        {mine && (m._status || m.is_read) && (
                          <span className="ml-1" aria-label={m.is_read ? 'read' : m._status === 'delivered' ? 'delivered' : 'sent'}>
                            {m.is_read || m._status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                        {mine && m.is_read && m.read_at && (
                          <span className="ml-1 opacity-80">· read {format(new Date(m.read_at), 'p')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {queueItems.length > 0 && (
          <div className="space-y-2">
            {queueItems.map((q) => (
              <div key={q.id} className="flex justify-end">
                <div className="max-w-[75%] space-y-2 rounded-2xl rounded-br-sm border border-[#F8C301]/15 bg-[linear-gradient(135deg,rgba(232,112,21,0.28)_0%,rgba(248,195,1,0.18)_100%)] px-3 py-2 text-sm text-slate-100 shadow-[0_16px_34px_-22px_rgba(248,195,1,0.35)]">
                  {q.previewUrl && (
                    <img
                      src={q.previewUrl}
                      alt="uploading"
                      className="rounded-lg max-h-48 w-auto object-cover opacity-80"
                    />
                  )}
                  {!q.previewUrl && q.file && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{q.file.name}</span>
                    </div>
                  )}
                  {q.content && (
                    <p className="whitespace-pre-wrap break-words opacity-80">{q.content}</p>
                  )}
                  <div className="h-1 w-full bg-background/40 overflow-hidden rounded">
                    <div
                      className={cn(
                        'h-full transition-all',
                        q.status === 'error' || q.status === 'blocked'
                          ? 'bg-destructive'
                          : 'bg-secondary-foreground/70',
                      )}
                      style={{
                        width: `${q.status === 'error' || q.status === 'blocked' ? 100 : q.progress}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] opacity-80">
                    <span>
                      {q.status === 'uploading' && `Uploading… ${q.progress}%`}
                      {q.status === 'scanning' && 'Scanning for malware…'}
                      {q.status === 'sending' && 'Sending…'}
                      {q.status === 'queued' && (q.error || 'Queued')}
                      {q.status === 'done' && 'Sent'}
                      {q.status === 'error' && (q.error || 'Failed')}
                      {q.status === 'blocked' && (q.error || 'Blocked by security scan')}
                    </span>
                    {(q.status === 'error' || q.status === 'blocked') && (
                      <div className="flex gap-2">
                        {q.status === 'error' && (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => uploadQueue.retry(q.id)}
                          >
                            Retry
                          </button>
                        )}
                        <button
                          type="button"
                          className="underline opacity-70"
                          onClick={() => uploadQueue.remove(q.id)}
                        >
                          {q.status === 'blocked' ? 'Dismiss' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      <form onSubmit={handleSend} className="space-y-2 border-t border-white/10 bg-[rgba(5,10,18,0.98)] p-3">
        {pendingFile && (
          <div className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.05] p-3 text-slate-100 backdrop-blur-xl">
            {filePreview ? (
              <img
                src={filePreview}
                alt="preview"
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                <FileText className="h-5 w-5 text-slate-300/72" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-slate-100">{pendingFile.name}</p>
              <p className="text-[10px] text-slate-400">
                {(pendingFile.size / 1024).toFixed(0)} KB · auto-deletes in 48h
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPendingFile(null)}
              aria-label="Remove attachment"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {uploadPct !== null && (
          <div className="h-1 w-full bg-muted overflow-hidden rounded">
            <div
              className="h-full bg-secondary transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        )}
        <div className="flex items-end gap-1.5 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
            className="h-11 w-11 rounded-2xl border border-white/10 text-slate-300 hover:bg-white/[0.06]"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Add emoji" className="h-11 w-11 rounded-2xl border border-white/10 text-slate-300 hover:bg-white/[0.06]">
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="p-0 border-0 w-auto bg-transparent shadow-none"
            >
              <Suspense
                fallback={
                  <div className="h-80 w-72 flex items-center justify-center rounded-lg border bg-popover">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                }
              >
                <EmojiPicker
                  lazyLoadEmojis
                  width={300}
                  height={360}
                  onEmojiClick={(d) => {
                    insertEmoji(d.emoji)
                    setEmojiOpen(false)
                  }}
                />
              </Suspense>
            </PopoverContent>
          </Popover>
          <VoiceRecorderButton
            disabled={!user}
            onSend={(file, _ms) => {
              if (!user) return
              uploadQueue.enqueue({
                conversationId,
                senderId: user.id,
                content: '',
                file,
              })
            }}
          />
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Write a message..."
            rows={1}
            className="min-h-[42px] max-h-32 resize-none border-0 bg-transparent text-white placeholder:text-slate-500 focus-visible:ring-0"
          />
          <Button type="submit" size="icon" disabled={!canSend} className="h-11 w-11 rounded-2xl text-slate-950 disabled:opacity-50" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: canSend ? GOLD_SHADOW : 'none' }}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  )
}


function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  // Absolute timestamp (ms) until which we know the user is rate-limited.
  // Lifted to the dialog so it persists across query refetches and keystrokes.
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number>(0)
  const [nowTs, setNowTs] = useState<number>(() => Date.now())

  const remainingMs = Math.max(0, rateLimitedUntil - nowTs)
  const isRateLimited = remainingMs > 0

  // Tick once per second only while a wait is active, so the countdown stays
  // smooth and consistent even if new search attempts come in.
  useEffect(() => {
    if (!isRateLimited) return
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isRateLimited])

  const usersQ = useQuery({
    queryKey: ['user-search', q],
    // Suspend searches entirely while waiting — no need to spam the server.
    enabled: q.trim().length >= 2 && !isRateLimited,
    queryFn: async () => {
      const term = q.trim()
      const { data, error } = await supabase.rpc('search_public_profiles', {
        _term: term,
        _limit: 15,
      })
      if (error) {
        const retry = parseRetryAfter(error.message)
        if (retry !== null) {
          const candidate = Date.now() + retry * 1000
          // Only extend the wait — never shorten it — so consecutive errors
          // from the server can't make the countdown jump around.
          setRateLimitedUntil((prev) => (candidate > prev ? candidate : prev))
        }
        throw error
      }
      return ((data ?? []) as Profile[]).filter((u) => u.id !== user?.id)
    },
    retry: false,
  })

  const startChat = async (other: Profile) => {
    if (!user) return
    setCreating(true)
    try {
      const [a, b] = [user.id, other.id].sort()
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`,
        )
        .maybeSingle()
      let convoId = existing?.id as string | undefined
      if (!convoId) {
        const { data: created, error } = await supabase
          .from('conversations')
          .insert({ user1_id: a, user2_id: b })
          .select('id')
          .single()
        if (error) throw error
        convoId = created.id
      }
      qc.invalidateQueries({ queryKey: ['conversations', user.id] })
      onClose()
      navigate(`/messages/${convoId}`)
    } catch (e: any) {
      toast.error(e.message || 'Could not start conversation')
    } finally {
      setCreating(false)
    }
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const showRateLimit = isRateLimited || (usersQ.isError && /rate limit/i.test((usersQ.error as Error)?.message ?? ''))

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New Message</DialogTitle>
        <DialogDescription>Search for a user to start a conversation.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or @username"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          {q.trim().length < 2 ? (
            <div className="p-4 text-xs text-muted-foreground">
              Type at least 2 characters to search.
            </div>
          ) : showRateLimit ? (
            <div className="p-4 text-xs text-destructive">
              You're searching too fast.{' '}
              {remainingSeconds > 0
                ? `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} and try again.`
                : 'You can try again now.'}
            </div>
          ) : usersQ.isLoading ? (
            <div className="p-4 text-xs text-muted-foreground">Searching…</div>
          ) : usersQ.isError ? (
            <div className="p-4 text-xs text-destructive">Search failed. Please try again.</div>
          ) : (usersQ.data ?? []).length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No users found.</div>
          ) : (
            usersQ.data!.map((u) => (
              <button
                key={u.id}
                disabled={creating}
                onClick={() => startChat(u)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/60 text-left"
              >
                <Avatar profile={u} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.display_name || u.username || 'User'}
                  </p>
                  {u.username && (
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </DialogContent>
  )
}

function parseRetryAfter(msg: string | undefined): number | null {
  if (!msg) return null
  const m = msg.match(/retry[_ ]after[=:\s]+(\d+)/i) || msg.match(/retry in (\d+)\s*seconds?/i)
  return m ? Math.max(1, parseInt(m[1], 10)) : null
}



