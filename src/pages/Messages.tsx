import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import {
  ArrowLeft,
  MessageSquarePlus,
  Search,
  Send,
  Loader2,
  Paperclip,
  Smile,
  X,
  FileText,
  Download,
} from 'lucide-react'
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
import { VoiceBubble } from '@/components/messages/VoiceBubble'
import { VoiceRecorderButton } from '@/components/messages/VoiceRecorder'

import { uploadQueue } from '@/lib/uploadQueue'
import { useUploadQueue } from '@/hooks/useUploadQueue'
import { moderateContent } from '@/lib/moderateContent'

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
          .order('created_at', { ascending: false }),
      ])
      const profileMap: Record<string, Profile> = {}
      ;(profiles ?? []).forEach((p: any) => (profileMap[p.id] = p))
      const lastMap: Record<string, { content: string; created_at: string }> = {}
      const unreadMap: Record<string, number> = {}
      ;(msgs ?? []).forEach((m: any) => {
        if (!lastMap[m.conversation_id]) {
          lastMap[m.conversation_id] = {
            content: m.content || '📎 Attachment',
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
      .channel(`messages-inbox:${user.id}`)
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
    <div className="container mx-auto px-0 md:px-4 py-0 md:py-6">
      <div className="md:rounded-2xl md:border md:bg-card overflow-hidden h-[calc(100vh-5rem)] md:h-[calc(100vh-8rem)] flex">
        {/* LEFT */}
        <aside
          className={cn(
            'w-full md:w-80 border-r flex-col bg-background',
            conversationId ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="p-4 border-b flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold">Messages</h1>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="New message">
                  <MessageSquarePlus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <NewMessageDialog onClose={() => setNewOpen(false)} />
            </Dialog>
          </div>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convosQ.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No conversations yet.
              </div>
            ) : (
              filteredConvos.map((c) => {
                const active = c.id === conversationId
                return (
                  <Link
                    key={c.id}
                    to={`/messages/${c.id}`}
                    className={cn(
                      'flex items-start gap-3 px-3 py-3 border-l-4 hover:bg-muted/50 transition-colors',
                      active ? 'border-secondary bg-secondary/5' : 'border-transparent',
                    )}
                  >
                    <Avatar profile={c.other_user} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">
                          {c.other_user?.display_name || c.other_user?.username || 'User'}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.last_message_at &&
                            formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {c.last_message || 'No messages yet'}
                        </p>
                        {!!c.unread_count && (
                          <span className="text-[10px] font-bold bg-secondary text-secondary-foreground rounded-full px-1.5 min-w-[18px] text-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </aside>

        {/* RIGHT */}
        <section
          className={cn(
            'flex-1 flex-col bg-background',
            conversationId ? 'flex' : 'hidden md:flex',
          )}
        >
          {!conversationId ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <MessageSquarePlus className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Select a conversation to start messaging
                </p>
              </div>
            </div>
          ) : (
            <ConversationView
              conversationId={conversationId}
              other={activeConvo?.other_user}
              onBack={() => navigate('/messages')}
            />
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
  const queryKey = ['messages', conversationId]
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Message[]
    },
  })

  // Realtime: merge INSERT/UPDATE directly into cache (no refetch, no duplicates)
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages-${conversationId}`)
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
          const nowIso = new Date().toISOString()
          // Optimistic local patch — no refetch, no duplicate render.
          qc.setQueryData<Message[]>(queryKey, (prev) =>
            (prev ?? []).map((m) =>
              m.id === id ? { ...m, is_read: true, read_at: m.read_at ?? nowIso } : m,
            ),
          )
          supabase.rpc('mark_message_read', { _message_id: id }).then(() => {
            qc.invalidateQueries({ queryKey: ['conversations', user.id] })
            qc.invalidateQueries({ queryKey: ['messages-unread', user.id] })
          })
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

  return (
    <>
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar profile={other} size="sm" />
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {other?.display_name || other?.username || 'Conversation'}
          </p>
          {other?.username && (
            <p className="text-xs text-muted-foreground truncate">@{other.username}</p>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                const hasImage =
                  m.attachment_url && (m.attachment_type?.startsWith('image/') ?? false)
                const hasAudio =
                  m.attachment_url &&
                  ((m.attachment_type?.startsWith('audio/') ?? false) ||
                    /\.(webm|mp3|m4a|ogg|wav|aac)(\?|$)/i.test(m.attachment_url || ''))
                const hasFile = m.attachment_url && !hasImage && !hasAudio
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
                          ? 'bg-secondary text-secondary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm',
                        m._optimistic && 'opacity-70',
                      )}
                    >
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
                      {hasAudio && (
                        <VoiceBubble src={m.attachment_url!} mine={mine} />
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
                          'text-[10px] opacity-70',
                          mine ? 'text-right' : 'text-left',
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
                <div className="max-w-[75%] rounded-2xl rounded-br-sm px-3 py-2 text-sm space-y-2 bg-secondary/60 text-secondary-foreground">
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


      <form onSubmit={handleSend} className="p-3 border-t space-y-2">
        {pendingFile && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-2">
            {filePreview ? (
              <img
                src={filePreview}
                alt="preview"
                className="h-12 w-12 rounded object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded bg-background flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{pendingFile.name}</p>
              <p className="text-[10px] text-muted-foreground">
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
        <div className="flex items-end gap-1.5">
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
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          {user && (
            <VoiceRecorderButton
              disabled={!conversationId}
              onSend={(file) => {
                uploadQueue.enqueue({
                  conversationId,
                  senderId: user.id,
                  content: '',
                  file,
                })
              }}
            />
          )}
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Add emoji">
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
            className="resize-none min-h-[40px] max-h-32"
          />
          <Button type="submit" size="icon" disabled={!canSend}>
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

  const usersQ = useQuery({
    queryKey: ['user-search', q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = `%${q.trim()}%`
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, display_name, username, avatar_url')
        .or(`display_name.ilike.${term},username.ilike.${term}`)
        .neq('id', user?.id || '')
        .limit(15)
      if (error) throw error
      return (data ?? []) as Profile[]
    },
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
          ) : usersQ.isLoading ? (
            <div className="p-4 text-xs text-muted-foreground">Searching…</div>
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
