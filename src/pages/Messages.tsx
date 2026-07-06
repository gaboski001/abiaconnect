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
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Reply,
  Pencil,
  Trash2,
  Copy,
  Forward,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  MoreVertical,
  MoreHorizontal,
  CheckCircle2,
  Ban,
} from 'lucide-react'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { callManager } from '@/lib/webrtcCall'
import { SEO } from '@/components/SEO'
import { toast } from '@/lib/toast'
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
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { VoiceRecorderButton } from '@/components/messages/VoiceRecorder'

import { uploadQueue } from '@/lib/uploadQueue'
import { useUploadQueue } from '@/hooks/useUploadQueue'
import { moderateContent } from '@/lib/moderateContent'
import { showModerationBlocked } from '@/components/moderation/ModerationBlockedDialog'

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
  pinned_at?: string | null
  archived_at?: string | null
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
  attachment_path?: string | null
  attachment_type?: string | null
  attachment_name?: string | null
  attachment_size?: number | null
  attachment_expires_at?: string | null
  reply_to_id?: string | null
  edited_at?: string | null
  deleted_for_everyone?: boolean | null
  deleted_at?: string | null
  forwarded_from_id?: string | null
  _optimistic?: boolean
  _status?: 'sent' | 'delivered'
}

/** Chat action state driven by the per-bubble menu (reply / edit) and toolbar (forward). */
interface ChatAction {
  reply?: Message | null
  edit?: Message | null
  forward?: Message | null
}

const EDIT_WINDOW_MS = 15 * 60 * 1000
const DELETE_WINDOW_MS = 60 * 60 * 1000

function canEdit(m: Message, userId?: string) {
  if (!userId || m.sender_id !== userId) return false
  if (m.deleted_for_everyone) return false
  if (m._optimistic) return false
  return Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS
}
function canDeleteForEveryone(m: Message, userId?: string) {
  if (!userId || m.sender_id !== userId) return false
  if (m.deleted_for_everyone) return false
  if (m._optimistic) return false
  return Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS
}
function messagePreview(m: Pick<Message, 'content' | 'attachment_type' | 'attachment_name' | 'deleted_for_everyone'>) {
  if (m.deleted_for_everyone) return '🚫 This message was deleted'
  if (m.content?.trim()) return m.content
  if (m.attachment_type?.startsWith('image/')) return '📷 Photo'
  if (m.attachment_type?.startsWith('audio/')) return '🎤 Voice note'
  if (m.attachment_name) return `📎 ${m.attachment_name}`
  return '📎 Attachment'
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

/**
 * Resolves a chat attachment to a short-lived signed URL on demand from the
 * stored bucket path. Avoids persisting/exposing long-lived backend URLs in
 * the message row, share sheets, or browser history.
 */
function useAttachmentUrl(m: Message): string | null {
  const source = m.attachment_path || m.attachment_url || null
  return useSignedUrl(source, 'chat-attachments', 60 * 60)
}

function MessageAttachment({ m, mine }: { m: Message; mine: boolean }) {
  const url = useAttachmentUrl(m)
  const hasImage = !!url && (m.attachment_type?.startsWith('image/') ?? false)
  const lowerName = (m.attachment_name || m.attachment_path || '').toLowerCase()
  const hasAudio =
    !!url &&
    ((m.attachment_type?.startsWith('audio/') ?? false) ||
      /\.(webm|mp3|m4a|ogg|wav|aac)$/i.test(lowerName))
  const hasFile = !!url && !hasImage && !hasAudio
  if (!url) return null
  if (hasImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={m.attachment_name || 'attachment'}
          loading="lazy"
          className="rounded-lg max-h-64 w-auto object-cover"
        />
      </a>
    )
  }
  if (hasAudio) return <VoiceBubble src={url} mine={mine} />
  if (hasFile) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download={m.attachment_name || undefined}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs',
          mine ? 'bg-secondary-foreground/10' : 'bg-background/60',
        )}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{m.attachment_name || 'Attachment'}</span>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </a>
    )
  }
  return null
}

/**
 * Sidebar row with WhatsApp-style row actions (pin/archive/clear/delete).
 * The row itself navigates; the ⋯ menu is a sibling so we don't nest a
 * button inside the <Link> (invalid HTML + unreliable clicks).
 */
function ConversationRow({
  c,
  active,
}: {
  c: Conversation
  active: boolean
  onOpenForward: () => void
}) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | 'clear' | 'delete'>(null)

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['conversations', user?.id] })

  const call = async (rpc: 'set_conversation_pinned' | 'set_conversation_archived' | 'clear_conversation' | 'delete_conversation', args: Record<string, unknown> = {}) => {
    const { error } = await supabase.rpc(rpc as never, { _conversation_id: c.id, ...args } as never)
    if (error) {
      toast.error(error.message || 'Action failed')
      return false
    }
    return true
  }

  const pinned = !!c.pinned_at
  const archived = !!c.archived_at

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 px-3 py-3 border-l-4 hover:bg-muted/50 transition-colors',
        active ? 'border-secondary bg-secondary/5' : 'border-transparent',
      )}
    >
      <Link
        to={`/messages/${c.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open conversation with ${c.other_user?.display_name || c.other_user?.username || 'user'}`}
      />
      <div className="relative z-[1] pointer-events-none">
        <Avatar profile={c.other_user} />
      </div>
      <div className="relative z-[1] min-w-0 flex-1 pointer-events-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate flex items-center gap-1">
            {pinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
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
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Conversation actions"
            className="relative z-[2] h-8 w-8 shrink-0 grid place-items-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity data-[state=open]:opacity-100"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          <MenuItem
            icon={pinned ? PinOff : Pin}
            label={pinned ? 'Unpin chat' : 'Pin chat'}
            onSelect={async () => {
              setMenuOpen(false)
              if (await call('set_conversation_pinned', { _pinned: !pinned })) {
                toast.success(pinned ? 'Chat unpinned' : 'Chat pinned to top')
                invalidate()
              }
            }}
          />
          <MenuItem
            icon={archived ? ArchiveRestore : Archive}
            label={archived ? 'Unarchive' : 'Archive'}
            onSelect={async () => {
              setMenuOpen(false)
              if (await call('set_conversation_archived', { _archived: !archived })) {
                toast.success(archived ? 'Chat restored' : 'Chat archived')
                invalidate()
              }
            }}
          />
          <MenuItem
            icon={Ban}
            label="Clear messages"
            onSelect={() => {
              setMenuOpen(false)
              setConfirm('clear')
            }}
          />
          <MenuItem
            icon={Trash2}
            label="Delete chat"
            destructive
            onSelect={() => {
              setMenuOpen(false)
              setConfirm('delete')
            }}
          />
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={confirm === 'clear'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Clear all messages?"
        description="This removes every message in this chat for both of you. This cannot be undone."
        confirmLabel="Clear"
        destructive
        onConfirm={async () => {
          if (await call('clear_conversation')) {
            toast.success('Messages cleared')
            qc.setQueryData<Message[]>(['messages', c.id], [])
            invalidate()
          }
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete this chat?"
        description="The entire conversation, its messages, and its history will be removed for both of you."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (await call('delete_conversation')) {
            toast.success('Chat deleted')
            invalidate()
            if (active) navigate('/messages')
          }
          setConfirm(null)
        }}
      />
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
  destructive,
  disabled,
}: {
  icon: typeof Pin
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left transition-colors',
        'hover:bg-muted focus-visible:bg-muted disabled:opacity-40 disabled:pointer-events-none',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}



export default function Messages() {
  const { user } = useAuth()
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null)

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
      const [{ data: profiles }, { data: msgs }, { data: states }] = await Promise.all([
        supabase.rpc('get_public_profiles', { _ids: otherIds }),
        supabase
          .from('messages')
          .select('conversation_id, sender_id, content, is_read, created_at, deleted_for_everyone, attachment_type, attachment_name')
          .in('conversation_id', ids)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversation_states')
          .select('conversation_id, pinned_at, archived_at')
          .eq('user_id', user!.id)
          .in('conversation_id', ids),
      ])
      const profileMap: Record<string, Profile> = {}
      ;(profiles ?? []).forEach((p: any) => (profileMap[p.id] = p))
      const lastMap: Record<string, { content: string; created_at: string }> = {}
      const unreadMap: Record<string, number> = {}
      ;(msgs ?? []).forEach((m: any) => {
        if (!lastMap[m.conversation_id]) {
          lastMap[m.conversation_id] = {
            content: messagePreview(m),
            created_at: m.created_at,
          }
        }
        if (!m.is_read && m.sender_id !== user!.id) {
          unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1
        }
      })
      const stateMap: Record<string, { pinned_at?: string | null; archived_at?: string | null }> = {}
      ;(states ?? []).forEach((s: any) => (stateMap[s.conversation_id] = s))
      const enriched = list.map((c) => {
        const otherId = c.user1_id === user!.id ? c.user2_id : c.user1_id
        const s = stateMap[c.id] || {}
        return {
          ...c,
          other_user: profileMap[otherId] || { id: otherId },
          last_message: lastMap[c.id]?.content ?? null,
          last_message_at: lastMap[c.id]?.created_at ?? c.updated_at,
          unread_count: unreadMap[c.id] || 0,
          pinned_at: s.pinned_at ?? null,
          archived_at: s.archived_at ?? null,
        } as Conversation
      })
      // Pinned first, then by last activity
      enriched.sort((a, b) => {
        const ap = a.pinned_at ? 1 : 0
        const bp = b.pinned_at ? 1 : 0
        if (ap !== bp) return bp - ap
        const at = new Date(a.last_message_at || a.updated_at).getTime()
        const bt = new Date(b.last_message_at || b.updated_at).getTime()
        return bt - at
      })
      return enriched
    },
  })

  // Realtime: refresh conversation list on new messages OR pin/archive changes
  useEffect(() => {
    if (!user) return
    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ['conversations', user.id] })
    const channel = supabase
      .channel(`messages-inbox:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, invalidate)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, invalidate)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_states', filter: `user_id=eq.${user.id}` },
        invalidate,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, qc])

  const { activeList, archivedList, filteredConvos } = useMemo(() => {
    const list = convosQ.data ?? []
    const q = search.trim().toLowerCase()
    const matches = q
      ? list.filter((c) =>
          (c.other_user?.display_name || c.other_user?.username || '').toLowerCase().includes(q),
        )
      : list
    const activeList = matches.filter((c) => !c.archived_at)
    const archivedList = matches.filter((c) => !!c.archived_at)
    const filteredConvos = showArchived ? archivedList : activeList
    return { activeList, archivedList, filteredConvos }
  }, [convosQ.data, search, showArchived])

  const activeConvo = useMemo(
    () =>
      (convosQ.data ?? []).find((c) => c.id === conversationId) || null,
    [convosQ.data, conversationId],
  )

  return (
    <>
      <SEO title="Your Messages" description="View and manage your private conversations on AbiaConnect." path="/messages" />
    <div className="container mx-auto px-0 md:px-4 py-0 md:py-6">
      <div className="md:rounded-2xl md:border md:bg-card overflow-hidden h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-8rem)] flex bg-gradient-to-b from-background to-muted/30">

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
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="pl-9"
              />
            </div>
            {archivedList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="font-medium">
                  {showArchived ? 'Back to chats' : `Archived · ${archivedList.length}`}
                </span>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {convosQ.isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : filteredConvos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {showArchived ? 'No archived chats.' : 'No conversations yet.'}
              </div>
            ) : (
              filteredConvos.map((c) => (
                <ConversationRow
                  key={c.id}
                  c={c}
                  active={c.id === conversationId}
                  onOpenForward={() => {
                    /* row-level forward is not supported; forward is per-message */
                  }}
                />
              ))
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
              onForward={(m) => setForwardMessage(m)}
            />
          )}
        </section>
      </div>
    </div>
    <ForwardDialog
      message={forwardMessage}
      onClose={() => setForwardMessage(null)}
      conversations={convosQ.data ?? []}
    />
    </>
  )
}

function ConversationView({
  conversationId,
  other,
  onBack,
  onForward,
}: {
  conversationId: string
  other?: Profile | null
  onBack: () => void
  onForward: (m: Message) => void
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
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset reply/edit when switching conversations
  useEffect(() => {
    setReplyTo(null)
    setEditing(null)
  }, [conversationId])

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

  // --- Auto-scroll that respects the user's manual scroll --------------------
  // We only pin to the bottom when the user is already there. If they've
  // scrolled up to read older messages, incoming messages must not yank the
  // viewport back down. When they send a message themselves we *do* force a
  // scroll — that's an explicit intent to see their new message.
  const stickToBottomRef = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)

  const isNearBottom = (el: HTMLDivElement, threshold = 96) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < threshold

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    stickToBottomRef.current = true
  }

  // Track whether the user is pinned to the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      stickToBottomRef.current = isNearBottom(el)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Snap to bottom when the conversation first loads.
  useEffect(() => {
    if (!messagesQ.data?.length) return
    if (lastMessageIdRef.current == null) {
      scrollToBottom('auto')
    }
    lastMessageIdRef.current = messagesQ.data[messagesQ.data.length - 1]?.id ?? null
    // Reset stickiness when the user switches conversations.
    return () => {
      lastMessageIdRef.current = null
      stickToBottomRef.current = true
    }
  }, [conversationId])

  // Auto-scroll on new messages, only if the user is still at the bottom.
  useEffect(() => {
    const list = messagesQ.data
    if (!list?.length) return
    const newestId = list[list.length - 1]?.id ?? null
    const changed = newestId !== lastMessageIdRef.current
    lastMessageIdRef.current = newestId
    if (!changed) return
    // Always follow our own outgoing (optimistic) messages; only follow
    // incoming ones when the user hasn't scrolled up.
    const newest = list[list.length - 1]
    const mine = newest?.sender_id === user?.id
    if (mine || stickToBottomRef.current) {
      // Wait one frame so the newly-rendered bubble is in the DOM before we
      // compute scrollHeight.
      requestAnimationFrame(() => scrollToBottom(mine ? 'smooth' : 'smooth'))
    }
  }, [messagesQ.data, user?.id])


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
    // Sending is an explicit intent to see the newest message — re-pin the
    // viewport even if the user had scrolled up while reading.
    stickToBottomRef.current = true
    requestAnimationFrame(() => scrollToBottom('smooth'))


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
        // AI moderation — block abusive chat content before persisting.
        const mod = await moderateContent('message', text)
        if (!mod.allowed) {
          qc.setQueryData<Message[]>(queryKey, (prev) =>
            (prev ?? []).filter((m) => m.id !== optimistic.id),
          )
          showModerationBlocked({ surface: 'message', content: text, ...mod })
          toast.error('Message blocked by AI moderation.')
          setDraft((d) => d || text)
          return
        }
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
  const messageById = useMemo(() => {
    const map = new Map<string, Message>()
    ;(messagesQ.data ?? []).forEach((m) => map.set(m.id, m))
    return map
  }, [messagesQ.data])

  return (
    <>
      <div className="sticky top-0 z-10 px-3 md:px-4 py-2.5 border-b bg-background/85 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/70 flex items-center gap-2 shadow-[0_1px_0_0_hsl(var(--border))]">
        <Button variant="ghost" size="icon" className="md:hidden -ml-1 rounded-full" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar profile={other} size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-semibold text-sm truncate">
            {other?.display_name || other?.username || 'Conversation'}
          </p>
          {other?.username && (
            <p className="text-[11px] text-muted-foreground truncate">@{other.username}</p>
          )}
        </div>
        {/* Native-only WhatsApp-style call button. Hidden on the web project. */}
        {isNativeApp() && other?.id && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 active:scale-95 transition-transform"
            aria-label={`Call ${other.display_name || other.username || 'user'}`}
            onClick={() => {
              try {
                callManager.startCall({
                  id: other.id,
                  name: other.display_name || other.username || 'User',
                  avatarUrl: other.avatar_url ?? null,
                  conversationId,
                })
              } catch (e) {
                toast.error((e as Error).message || 'Could not start call')
              }
            }}
          >
            <Phone className="h-5 w-5" />
          </Button>
        )}
      </div>


      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-5">
        {messagesQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">
            Say hi to start the conversation 👋
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.date} className="space-y-2">
              <div className="flex justify-center">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                  {g.date}
                </span>
              </div>

              {g.items.map((m) => {
                const mine = m.sender_id === user?.id
                const hasAttachment = !!(m.attachment_path || m.attachment_url)
                const callInfo = parseCallLog(m.content)
                if (callInfo) {
                  // Hide call activity entirely on the web project.
                  if (!isNativeApp()) return null
                  return (
                    <CallLogRow
                      key={m.id}
                      mine={mine}
                      info={callInfo}
                      createdAt={m.created_at}
                    />
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
                        'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm space-y-2 shadow-sm ring-1',
                        mine
                          ? 'bg-secondary text-secondary-foreground rounded-br-md ring-secondary/30'
                          : 'bg-card text-foreground rounded-bl-md ring-border/60',
                        m._optimistic && 'opacity-70',
                      )}
                    >

                      {hasAttachment && <MessageAttachment m={m} mine={mine} />}
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


      <form
        onSubmit={handleSend}
        className="sticky bottom-0 z-10 p-3 border-t bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 space-y-2 shadow-[0_-1px_0_0_hsl(var(--border))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
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
            className="resize-none min-h-[40px] max-h-32 rounded-2xl bg-muted/60 border-muted focus-visible:bg-background transition-colors"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className="rounded-full shadow-md active:scale-95 transition-transform disabled:opacity-40"
          >
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

// -------- WhatsApp-style call log rendering (native only) --------
//
// The call manager writes conversation "call log" entries into the messages
// table as content strings so both peers can see the same history without a
// second table. Formats we recognise:
//   `[call:ended] 42s`         -> completed voice call, duration in seconds
//   `[call:missed] No answer`  -> missed / cancelled / rejected call
//
// `parseCallLog` returns null for regular chat messages so the normal bubble
// path is used.
export type CallLogInfo =
  | { kind: 'ended'; durationSec: number }
  | { kind: 'missed'; reason: string }

export function parseCallLog(content: string | null | undefined): CallLogInfo | null {
  if (!content) return null
  const ended = /^\[call:ended\]\s+(\d+)s\s*$/i.exec(content)
  if (ended) return { kind: 'ended', durationSec: parseInt(ended[1], 10) || 0 }
  const missed = /^\[call:missed\]\s*(.*)$/i.exec(content)
  if (missed) return { kind: 'missed', reason: missed[1]?.trim() || 'No answer' }
  return null
}

function formatCallDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function CallLogRow({
  mine,
  info,
  createdAt,
}: {
  mine: boolean
  info: CallLogInfo
  createdAt: string
}) {
  const isMissed = info.kind === 'missed'
  const Icon = isMissed ? PhoneMissed : mine ? PhoneOutgoing : PhoneIncoming
  const tone = isMissed
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-emerald-600 dark:text-emerald-400'
  const label = isMissed
    ? mine ? 'Cancelled call' : 'Missed voice call'
    : mine ? 'Outgoing voice call' : 'Incoming voice call'
  const detail = info.kind === 'ended' ? formatCallDuration(info.durationSec) : info.reason

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl px-3 py-2 text-sm border',
          mine
            ? 'bg-secondary/60 text-secondary-foreground rounded-br-sm border-secondary'
            : 'bg-muted text-foreground rounded-bl-sm border-border',
        )}
      >
        <span className={cn('grid place-items-center h-8 w-8 rounded-full bg-background/60', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-medium leading-tight">{label}</p>
          <p className="text-[11px] opacity-70">
            {detail} · {format(new Date(createdAt), 'p')}
          </p>
        </div>
      </div>
    </div>
  )
}
