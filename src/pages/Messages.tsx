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
  Video,
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
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { useMessageReactions, type ReactionAgg } from '@/hooks/useMessageReactions'



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
  /**
   * Client-side delivery lifecycle:
   *  - 'sent'      → single ✓, server has our row (or optimistic)
   *  - 'delivered' → ✓✓ grey, recipient's client acknowledged over Realtime broadcast
   *  is_read (from DB)  → ✓✓ blue, recipient actually saw the bubble
   */
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

function MessageAttachment({ m, mine, native }: { m: Message; mine: boolean; native?: boolean }) {
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
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'block overflow-hidden rounded-lg',
          native && 'ring-1 ring-white/10 bg-black/20',
        )}
      >
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
          'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors',
          native
            ? mine
              ? 'bg-black/25 text-white/95 hover:bg-black/35'
              : 'bg-white/5 text-white/95 hover:bg-white/10'
            : mine
              ? 'bg-secondary-foreground/10'
              : 'bg-background/60',
        )}
      >
        <FileText className={cn('h-4 w-4 shrink-0', native && 'text-emerald-300')} />
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, invalidate)
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
    <div className={cn('container mx-auto px-0 md:px-4 py-0 md:py-6', isNativeApp() && conversationId && 'h-full max-w-full p-0')}>
      <div className={cn('md:rounded-2xl md:border md:bg-card overflow-hidden flex bg-gradient-to-b from-background to-muted/30 transition-[height] duration-150', isNativeApp() && conversationId ? 'h-full md:h-[calc(100vh-8rem)]' : 'h-[calc(100dvh-var(--kb-inset,0px)-3.5rem)] md:h-[calc(100vh-8rem)]')}>


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

  // Dedupe stores that survive Realtime reconnects and TanStack refetches.
  //   deliveredOwnRef  → our own message IDs the peer has ack'd as delivered.
  //                      Reapplied to the cache on every refetch so ✓✓ persists
  //                      after a token refresh / network drop repopulates the list.
  //   deliveredAckedRef → inbound IDs we've already broadcast 'delivered' for,
  //                       so reconnect + open-conversation re-runs never spam
  //                       duplicate acks to the sender.
  const deliveredOwnRef = useRef<Set<string>>(new Set())
  const deliveredAckedRef = useRef<Set<string>>(new Set())

  // Reset per-conversation dedupe state when switching chats.
  useEffect(() => {
    deliveredOwnRef.current = new Set()
    deliveredAckedRef.current = new Set()
  }, [conversationId])

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
      const rows = (data ?? []) as Message[]
      // Re-hydrate client-only delivery state after a refetch. `is_read` is
      // persisted server-side so it survives on its own; `_status: 'delivered'`
      // is broadcast-only, so we replay the set we've been tracking.
      const delivered = deliveredOwnRef.current
      if (!delivered.size) return rows
      return rows.map((m) =>
        m.sender_id === user?.id && !m.is_read && delivered.has(m.id)
          ? { ...m, _status: 'delivered' as const }
          : m,
      )
    },
  })

  // Presence/broadcast channel for typing + delivery receipts.
  // Kept in a ref so send handlers can broadcast without re-subscribing.
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const otherTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef(0)

  // Realtime: merge INSERT/UPDATE directly into cache (no refetch, no duplicates)
  useEffect(() => {
    if (!conversationId || !user?.id) return
    const uid = user.id

    const ackDelivered = (messageId: string) => {
      // Idempotent: only broadcast the first time per session/reconnect cycle.
      if (deliveredAckedRef.current.has(messageId)) return
      deliveredAckedRef.current.add(messageId)
      chatChannelRef.current?.send({
        type: 'broadcast',
        event: 'delivered',
        payload: { messageId, by: uid },
      })
    }

    const ackAllUnreadInbound = () => {
      const list = qc.getQueryData<Message[]>(queryKey) ?? []
      for (const m of list) {
        if (m.sender_id !== uid && !m.is_read) ackDelivered(m.id)
      }
    }

    const channel = supabase
      .channel(`chat:${conversationId}`, { config: { broadcast: { self: false } } })
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
            // Own echo stays 'sent' (single ✓) until the recipient broadcasts 'delivered'.
            // If a peer ack already arrived (out-of-order over a laggy socket),
            // promote straight to 'delivered'.
            const initialStatus: 'sent' | 'delivered' =
              incoming.sender_id === uid && deliveredOwnRef.current.has(incoming.id)
                ? 'delivered'
                : 'sent'
            const next: Message = { ...incoming, _status: initialStatus }
            if (tempIdx >= 0) {
              const copy = list.slice()
              copy[tempIdx] = next
              return copy
            }
            return [...list, next]
          })
          // If this incoming message is FROM the other user, ack delivery back to them.
          if (incoming.sender_id !== uid) ackDelivered(incoming.id)
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
          // Multi-device: if THIS user is the recipient and another of their
          // devices just flipped is_read → true, refresh inbox unread badges
          // here too. Guarded by an actual state change so repeated no-op
          // UPDATEs (idempotent mark_message_read from a second device) don't
          // spam the inbox query.
          let readFlippedForMe = false
          qc.setQueryData<Message[]>(queryKey, (prev) =>
            (prev ?? []).map((m) => {
              if (m.id !== updated.id) return m
              if (
                updated.is_read === true &&
                m.is_read !== true &&
                updated.sender_id !== uid
              ) {
                readFlippedForMe = true
              }
              const merged: Message = { ...m, ...updated }
              // Preserve client-only delivered flag; if the row is now read
              // the ✓✓-blue path in the bubble takes over.
              if (!merged.is_read && deliveredOwnRef.current.has(merged.id)) {
                merged._status = 'delivered'
              }
              return merged
            }),
          )
          if (readFlippedForMe) {
            qc.invalidateQueries({ queryKey: ['conversations', uid] })
            qc.invalidateQueries({ queryKey: ['messages-unread', uid] })
          }
        },
      )
      // Typing indicator from the other participant.
      .on('broadcast', { event: 'typing' }, (msg) => {
        const from = (msg.payload as { from?: string; isTyping?: boolean })?.from
        const isTyping = (msg.payload as { isTyping?: boolean })?.isTyping
        if (!from || from === uid) return
        if (isTyping) {
          setOtherTyping(true)
          if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current)
          // Auto-clear if we stop hearing typing pings for 3.5s.
          otherTypingTimerRef.current = setTimeout(() => setOtherTyping(false), 3500)
        } else {
          if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current)
          setOtherTyping(false)
        }
      })
      // Delivery ack from the other participant → mark our own bubble as delivered.
      .on('broadcast', { event: 'delivered' }, (msg) => {
        const { messageId, by } = (msg.payload as { messageId?: string; by?: string }) ?? {}
        if (!messageId || !by || by === uid) return
        // Remember the ack across refetches, and skip redundant cache writes.
        if (deliveredOwnRef.current.has(messageId)) return
        deliveredOwnRef.current.add(messageId)
        qc.setQueryData<Message[]>(queryKey, (prev) =>
          (prev ?? []).map((m) => {
            if (m.id !== messageId || m.sender_id !== uid) return m
            if (m.is_read || m._status === 'delivered') return m
            return { ...m, _status: 'delivered' }
          }),
        )
      })
      .subscribe((status) => {
        // On (re)connect — including automatic resubscribe after a token refresh
        // or network blip — replay delivery acks for anything still unread. The
        // deliveredAckedRef Set keeps this idempotent, so we never spam the peer.
        if (status === 'SUBSCRIBED') ackAllUnreadInbound()
      })

    chatChannelRef.current = channel
    return () => {
      if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current)
      chatChannelRef.current = null
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id, qc])

  // First-load ack: covers the case where the channel is already SUBSCRIBED
  // before the initial fetch resolves. The Set dedupes against the reconnect
  // handler above.
  useEffect(() => {
    if (!user?.id || !messagesQ.data?.length || !chatChannelRef.current) return
    const uid = user.id
    for (const m of messagesQ.data) {
      if (m.sender_id !== uid && !m.is_read && !deliveredAckedRef.current.has(m.id)) {
        deliveredAckedRef.current.add(m.id)
        chatChannelRef.current.send({
          type: 'broadcast',
          event: 'delivered',
          payload: { messageId: m.id, by: uid },
        })
      }
    }
  }, [messagesQ.data, user?.id])


  // Throttled typing broadcaster wired to the composer's onChange.
  const sendTyping = (isTyping: boolean) => {
    const ch = chatChannelRef.current
    if (!ch || !user?.id) return
    const now = Date.now()
    // Cap outbound typing pings to ~1 every 1.5s while composing, but always
    // send an immediate 'stopped' event so the peer's indicator clears fast.
    if (isTyping && now - lastTypingSentRef.current < 1500) return
    lastTypingSentRef.current = isTyping ? now : 0
    ch.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: user.id, isTyping },
    })
  }

  // Stop-typing timer: 2s of idle keystrokes → broadcast stop.
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleDraftChange = (value: string) => {
    setDraft(value)
    if (value.trim().length > 0) {
      sendTyping(true)
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current)
      stopTypingTimerRef.current = setTimeout(() => sendTyping(false), 2000)
    } else {
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current)
      sendTyping(false)
    }
  }


  // --- Auto-scroll that respects the user's manual scroll --------------------
  // We only pin to the bottom when the user is already there. If they've
  // scrolled up to read older messages, incoming messages must not yank the
  // viewport back down. When they send a message themselves we *do* force a
  // scroll — that's an explicit intent to see their new message.
  const stickToBottomRef = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)
  // Drives the floating "Jump to latest" button. `atBottom` mirrors
  // `stickToBottomRef` as reactive state; `unreadNew` counts incoming
  // messages that landed while the user was scrolled up.
  const [atBottom, setAtBottom] = useState(true)
  const [unreadNew, setUnreadNew] = useState(0)

  const isNearBottom = (el: HTMLDivElement, threshold = 96) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < threshold

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    stickToBottomRef.current = true
    setAtBottom(true)
    setUnreadNew(0)
  }

  // Keep the transcript pinned to the newest message whenever the on-screen
  // keyboard opens or grows, on iOS and Android alike.
  useKeyboardInset(() => {
    if (stickToBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom('auto'))
    }
  })

  // Emoji reactions for messages currently rendered in this conversation.
  const messageIdList = useMemo(
    () => (messagesQ.data ?? []).map((m) => m.id),
    [messagesQ.data],
  )
  const { reactionsByMessage, toggleReaction } = useMessageReactions(
    conversationId,
    messageIdList,
    user?.id,
  )



  // Scroll to a specific message (used when tapping a quoted reply preview).
  // Flashes a ring around the target so the user's eye lands on it.
  const jumpToMessage = (id: string) => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector(`[data-mid="${CSS.escape(id)}"]`) as HTMLElement | null
    if (!el) {
      toast.info('Original message is no longer loaded')
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const flashClasses = ['ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-transparent', 'rounded-2xl']
    el.classList.add(...flashClasses)
    window.setTimeout(() => el.classList.remove(...flashClasses), 1500)
  }




  // Track whether the user is pinned to the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const near = isNearBottom(el)
      stickToBottomRef.current = near
      setAtBottom((prev) => (prev === near ? prev : near))
      if (near) setUnreadNew(0)
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
      setAtBottom(true)
      setUnreadNew(0)
    }
  }, [conversationId])

  // Auto-scroll on new messages, only if the user is still at the bottom.
  // If the user has scrolled up, count the new incoming message so the
  // floating "Jump to latest" pill can surface the backlog.
  useEffect(() => {
    const list = messagesQ.data
    if (!list?.length) return
    const newestId = list[list.length - 1]?.id ?? null
    const changed = newestId !== lastMessageIdRef.current
    lastMessageIdRef.current = newestId
    if (!changed) return
    const newest = list[list.length - 1]
    const mine = newest?.sender_id === user?.id
    if (mine || stickToBottomRef.current) {
      // Wait one frame so the newly-rendered bubble is in the DOM before we
      // compute scrollHeight.
      requestAnimationFrame(() => scrollToBottom('smooth'))
    } else {
      // Incoming message arrived while the user was reading history — surface
      // it on the jump-to-latest pill instead of yanking the viewport down.
      setUnreadNew((n) => n + 1)
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
    // Sending clears typing state immediately so the peer's "typing…" hides.
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current)
    sendTyping(false)

    // -------- EDIT PATH --------
    if (editing && user) {
      if (!text) {
        toast.error('Message cannot be empty.')
        return
      }
      const target = editing
      // Optimistic patch
      qc.setQueryData<Message[]>(queryKey, (prev) =>
        (prev ?? []).map((m) =>
          m.id === target.id ? { ...m, content: text, edited_at: new Date().toISOString() } : m,
        ),
      )
      setDraft('')
      setEditing(null)
      ;(async () => {
        const mod = await moderateContent('message', text)
        if (!mod.allowed) {
          qc.invalidateQueries({ queryKey })
          showModerationBlocked({ surface: 'message', content: text, ...mod })
          return
        }
        const { error } = await supabase.rpc('edit_message', {
          _message_id: target.id,
          _new_content: text,
        })
        if (error) {
          toast.error(error.message || 'Could not edit')
          qc.invalidateQueries({ queryKey })
        }
      })()
      return
    }

    if ((!text && !pendingFile) || !user) return
    const file = pendingFile
    const reply = replyTo
    setDraft('')
    setPendingFile(null)
    setReplyTo(null)
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
        reply_to_id: reply?.id ?? null,
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
          reply_to_id: reply?.id ?? null,
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

  const native = isNativeApp()
  return (
    <>
      <div
        className={cn(
          'sticky top-0 z-10 px-3 md:px-4 py-2.5 border-b flex items-center gap-2 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_0_hsl(var(--border))]',
          native
            ? 'bg-[#1f2c33] text-white border-black/40 pt-[max(0.625rem,env(safe-area-inset-top))]'
            : 'bg-background/85 supports-[backdrop-filter]:bg-background/70',
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn('md:hidden -ml-1 rounded-full', native && 'text-white hover:bg-white/10 hover:text-white')}
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar profile={other} size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className={cn('font-semibold text-sm truncate', native && 'text-white')}>
            {other?.display_name || other?.username || 'Conversation'}
          </p>
          {otherTyping ? (
            <p className={cn('text-[11px] truncate flex items-center gap-1', native ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400')}>
              <span className="inline-flex gap-0.5" aria-hidden>
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
              </span>
              typing…
            </p>
          ) : other?.username ? (
            <p className={cn('text-[11px] truncate', native ? 'text-white/60' : 'text-muted-foreground')}>@{other.username}</p>
          ) : null}
        </div>
        {/* Native-only WhatsApp-style call cluster. Hidden on the web project. */}
        {native && other?.id && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
              aria-label="Video call (coming soon)"
              onClick={() => toast.info('Video calls are coming soon')}
            >
              <Video className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
              aria-label={`Call ${other.display_name || other.username || 'user'}`}
              onClick={() => {
                try {
                  callManager.startCall({
                    id: other.id!,
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" side="bottom" className="w-52 p-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
                  onClick={() => toast.info('In-chat search is coming soon')}
                >
                  <Search className="h-4 w-4" /> Search in chat
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
                  onClick={async () => {
                    const { error } = await supabase.rpc('clear_conversation', { _conversation_id: conversationId })
                    if (error) toast.error(error.message || 'Could not clear')
                    else toast.success('Chat cleared')
                  }}
                >
                  <Archive className="h-4 w-4" /> Clear chat
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (!confirm('Delete this chat for you? This cannot be undone.')) return
                    const { error } = await supabase.rpc('delete_conversation', { _conversation_id: conversationId })
                    if (error) toast.error(error.message || 'Could not delete')
                    else {
                      toast.success('Chat deleted')
                      onBack()
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete chat
                </button>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>


      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-5',
          native && 'bg-[#0b141a] text-white',
        )}
        style={
          native
            ? {
                backgroundImage:
                  'radial-gradient(circle at 20% 10%, rgba(255,255,255,0.03) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.025) 0, transparent 45%)',
              }
            : undefined
        }
      >

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
                  <MessageBubble
                    key={m.id}
                    m={m}
                    mine={mine}
                    native={native}
                    hasAttachment={hasAttachment}

                    quoted={m.reply_to_id ? messageById.get(m.reply_to_id) ?? null : null}
                    userId={user?.id}
                    otherName={other?.display_name || other?.username || 'User'}
                    innerRef={!mine && !m.is_read ? registerMessageRef(m.id) : undefined}
                    onReply={() => {
                      setEditing(null)
                      setReplyTo(m)
                      textareaRef.current?.focus()
                    }}
                    onEdit={() => {
                      setReplyTo(null)
                      setEditing(m)
                      setDraft(m.content ?? '')
                      requestAnimationFrame(() => textareaRef.current?.focus())
                    }}
                    onDelete={async () => {
                      const { error } = await supabase.rpc('delete_message_for_everyone', {
                        _message_id: m.id,
                      })
                      if (error) toast.error(error.message || 'Could not delete')
                    }}
                    onForward={() => onForward(m)}
                    onCopy={() => {
                      if (m.content) {
                        navigator.clipboard.writeText(m.content).then(
                          () => toast.success('Copied'),
                          () => toast.error('Could not copy'),
                        )
                      }
                    }}
                    onJumpToQuoted={jumpToMessage}
                    reactions={reactionsByMessage.get(m.id) ?? []}
                    onToggleReaction={(emoji) => toggleReaction(m.id, emoji)}
                  />


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

        {/* Floating "Jump to latest" pill — sticky within the scroller so it
            hovers above the newest visible bubble without pinning to the
            composer. Only shows when the user has scrolled up from the tail. */}
        <div
          className={cn(
            'sticky bottom-2 z-20 flex justify-center pointer-events-none transition-opacity duration-150',
            atBottom ? 'opacity-0' : 'opacity-100',
          )}
          aria-hidden={atBottom}
        >
          {!atBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className={cn(
                'pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg active:scale-95 transition-transform',
                native
                  ? 'bg-[#005c4b] text-white ring-1 ring-emerald-300/40'
                  : 'bg-primary text-primary-foreground ring-1 ring-primary/40',
              )}
              aria-label={
                unreadNew > 0 ? `Jump to ${unreadNew} new message${unreadNew === 1 ? '' : 's'}` : 'Jump to latest'
              }
            >
              <ArrowLeft className="h-3.5 w-3.5 -rotate-90" />
              {unreadNew > 0 ? (
                <>
                  <span>{unreadNew} new</span>
                  <span
                    className={cn(
                      'ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.1rem] text-[10px] font-bold',
                      native ? 'bg-white text-[#005c4b]' : 'bg-primary-foreground text-primary',
                    )}
                  >
                    {unreadNew > 99 ? '99+' : unreadNew}
                  </span>
                </>
              ) : (
                <span>Jump to latest</span>
              )}
            </button>
          )}
        </div>
      </div>




      <form
        onSubmit={handleSend}
        className={cn(
          'sticky bottom-0 z-10 p-3 border-t backdrop-blur-xl space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          native
            ? 'bg-[#1f2c33] border-black/40 text-white shadow-[0_-1px_0_0_rgba(0,0,0,0.4)]'
            : 'bg-background/85 supports-[backdrop-filter]:bg-background/70 shadow-[0_-1px_0_0_hsl(var(--border))]',
        )}
      >

        {(replyTo || editing) && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border-l-4 px-3 py-2 text-xs',
              editing ? 'border-amber-500 bg-amber-500/10' : 'border-primary bg-muted/60',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={cn('font-semibold text-[11px] uppercase tracking-wide', editing ? 'text-amber-700 dark:text-amber-400' : 'text-primary')}>
                {editing ? 'Editing message' : `Replying to ${replyTo?.sender_id === user?.id ? 'yourself' : other?.display_name || other?.username || 'user'}`}
              </p>
              <p className="truncate text-muted-foreground mt-0.5">
                {messagePreview(editing || replyTo!)}
              </p>
            </div>
            <button
              type="button"
              aria-label={editing ? 'Cancel edit' : 'Cancel reply'}
              onClick={() => {
                if (editing) {
                  setEditing(null)
                  setDraft('')
                } else {
                  setReplyTo(null)
                }
              }}
              className="h-6 w-6 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
            onChange={(e) => handleDraftChange(e.target.value)}
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

// ============================================================================
// MessageBubble — WhatsApp-like bubble with reply-quote, edited/deleted
// markers, forwarded label, and per-message action menu.
// ============================================================================
function MessageBubble({
  m,
  mine,
  native,
  hasAttachment,
  quoted,
  userId,
  otherName,
  innerRef,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onCopy,
  onJumpToQuoted,
}: {
  m: Message
  mine: boolean
  native?: boolean
  hasAttachment: boolean
  quoted: Message | null
  userId?: string
  otherName: string
  innerRef?: (el: HTMLDivElement | null) => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onForward: () => void
  onCopy: () => void
  onJumpToQuoted?: (id: string) => void

}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const deleted = !!m.deleted_for_everyone
  const editable = canEdit(m, userId)
  const deletable = canDeleteForEveryone(m, userId)

  return (
    <div
      ref={innerRef}
      data-mid={m.id}
      className={cn('group flex items-end gap-1', mine ? 'justify-end' : 'justify-start')}
    >
      {mine && (
        <BubbleMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          mine
          canReply={!deleted}
          canCopy={!deleted && !!m.content}
          canForward={!deleted}
          canEdit={editable}
          canDelete={deletable}
          onReply={onReply}
          onCopy={onCopy}
          onForward={onForward}
          onEdit={onEdit}
          onDelete={() => setConfirm(true)}
        />
      )}
      <div
        className={cn(
          'relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm space-y-1.5 shadow-sm ring-1',
          native
            ? mine
              ? 'bg-[#005c4b] text-white rounded-br-md ring-transparent'
              : 'bg-[#1f2c33] text-white rounded-bl-md ring-white/5'
            : mine
              ? 'bg-secondary text-secondary-foreground rounded-br-md ring-secondary/30'
              : 'bg-card text-foreground rounded-bl-md ring-border/60',
          m._optimistic && 'opacity-70',
          deleted && 'italic opacity-70',
        )}
      >

        {m.forwarded_from_id && !deleted && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-60">
            <Forward className="h-3 w-3" /> Forwarded
          </div>
        )}
        {quoted && !deleted && (
          <button
            type="button"
            onClick={() => onJumpToQuoted?.(quoted.id)}
            className={cn(
              'w-full text-left rounded-lg px-2 py-1.5 border-l-2 text-xs mb-1 transition-colors cursor-pointer',
              native
                ? mine
                  ? 'bg-black/25 border-emerald-300/70 text-white/90 hover:bg-black/35 active:bg-black/45'
                  : 'bg-white/[0.06] border-emerald-400/70 text-white/90 hover:bg-white/[0.10] active:bg-white/[0.14]'
                : mine
                  ? 'bg-secondary-foreground/10 border-secondary-foreground/40 hover:bg-secondary-foreground/15'
                  : 'bg-muted border-primary/60 hover:bg-muted/80',
            )}
            aria-label="Jump to quoted message"
          >
            <p className={cn('font-semibold text-[11px] mb-0.5', native ? 'text-emerald-300' : 'opacity-80')}>
              {quoted.sender_id === userId ? 'You' : otherName}
            </p>
            <p className={cn('truncate', native ? 'text-white/70' : 'opacity-80')}>{messagePreview(quoted)}</p>
          </button>
        )}

        {deleted ? (
          <p className="whitespace-pre-wrap break-words flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5" />
            This message was deleted
          </p>
        ) : (
          <>
            {hasAttachment && <MessageAttachment m={m} mine={mine} native={native} />}

            {m.content && (
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            )}
          </>
        )}
        <p
          className={cn(
            'text-[10px] opacity-70 flex items-center gap-1',
            mine ? 'justify-end' : 'justify-start',
          )}
        >
          {m.edited_at && !deleted && <span className="italic">edited</span>}
          <span>{format(new Date(m.created_at), 'p')}</span>
          {mine && !deleted && (m._status || m.is_read) && (
            <span
              aria-label={m.is_read ? 'read' : m._status === 'delivered' ? 'delivered' : 'sent'}
              className={cn(m.is_read && 'text-sky-500')}
            >
              {m.is_read || m._status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </p>
      </div>
      {!mine && (
        <BubbleMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          canReply={!deleted}
          canCopy={!deleted && !!m.content}
          canForward={!deleted}
          onReply={onReply}
          onCopy={onCopy}
          onForward={onForward}
        />
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete message for everyone?"
        description="This message will be removed for both of you. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirm(false)
          onDelete()
        }}
      />
    </div>
  )
}

function BubbleMenu({
  open,
  onOpenChange,
  mine,
  canReply,
  canCopy,
  canForward,
  canEdit,
  canDelete,
  onReply,
  onCopy,
  onForward,
  onEdit,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mine?: boolean
  canReply?: boolean
  canCopy?: boolean
  canForward?: boolean
  canEdit?: boolean
  canDelete?: boolean
  onReply?: () => void
  onCopy?: () => void
  onForward?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Message actions"
          className={cn(
            'h-7 w-7 grid place-items-center rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity data-[state=open]:opacity-100 shrink-0',
            'md:opacity-0 opacity-100', // always visible on mobile
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={mine ? 'end' : 'start'} side="top" className="w-44 p-1">
        {canReply && <MenuItem icon={Reply} label="Reply" onSelect={() => { onOpenChange(false); onReply?.() }} />}
        {canCopy && <MenuItem icon={Copy} label="Copy" onSelect={() => { onOpenChange(false); onCopy?.() }} />}
        {canForward && <MenuItem icon={Forward} label="Forward" onSelect={() => { onOpenChange(false); onForward?.() }} />}
        {canEdit && <MenuItem icon={Pencil} label="Edit" onSelect={() => { onOpenChange(false); onEdit?.() }} />}
        {canDelete && <MenuItem icon={Trash2} destructive label="Delete for everyone" onSelect={() => { onOpenChange(false); onDelete?.() }} />}
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// ForwardDialog — pick an existing 1:1 conversation to forward to.
// ============================================================================
function ForwardDialog({
  message,
  onClose,
  conversations,
}: {
  message: Message | null
  onClose: () => void
  conversations: Conversation[]
}) {
  const { user } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const open = !!message

  const targets = useMemo(
    () =>
      conversations
        .filter((c) => c.id !== message?.conversation_id)
        .filter((c) => !c.archived_at)
        .slice(0, 100),
    [conversations, message?.conversation_id],
  )

  const forward = async (targetId: string) => {
    if (!message) return
    setBusy(targetId)
    const { error } = await supabase.rpc('forward_message', {
      _message_id: message.id,
      _to_conversation_id: targetId,
    })
    setBusy(null)
    if (error) {
      toast.error(error.message || 'Could not forward')
      return
    }
    toast.success('Message forwarded')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>
            Choose one of your existing chats to send this message to.
          </DialogDescription>
        </DialogHeader>
        {message && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground line-clamp-3">
            {messagePreview(message)}
          </div>
        )}
        <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
          {targets.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No other chats available.
            </p>
          ) : (
            targets.map((c) => {
              const other = c.other_user
              const name = other?.display_name || other?.username || 'User'
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => forward(c.id)}
                  disabled={busy === c.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
                >
                  <UserAvatar
                    avatarUrl={other?.avatar_url}
                    displayName={name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {other?.username && (
                      <p className="text-[11px] text-muted-foreground truncate">@{other.username}</p>
                    )}
                  </div>
                  {busy === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Forward className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
