import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { APP_HEADER_GRADIENT, GOLD_GRADIENT } from '@/lib/mobileBrand'
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
  BellOff,
  Bell,
  ShieldCheck,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
import { canPurchaseHere, getConversationSendStatus } from '@/lib/monetization/api'
import { messagingRuleText, t } from '@/lib/monetization/strings'
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
        className="block overflow-hidden rounded-lg"
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
          native && mine
            ? 'bg-black/25 text-white/95 hover:bg-black/35'
            : mine
              ? 'bg-secondary-foreground/10'
              : 'bg-background/60',
        )}
      >
        <FileText className={cn('h-4 w-4 shrink-0', native && mine && 'text-emerald-300')} />
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
  const native = isNativeApp()
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
        'native:mx-3 native:mb-2.5 native:items-center native:rounded-2xl native:border-l-0 native:bg-card native:p-3 native:shadow-sm',
        active ? 'border-secondary bg-secondary/5' : 'border-transparent',
      )}
    >
      <Link
        to={`/messages/${c.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open conversation with ${c.other_user?.display_name || c.other_user?.username || 'user'}`}
      />
      <div className="relative z-[1] pointer-events-none">
        <Avatar profile={c.other_user} size={native ? 'lg' : 'md'} />
        {native && !!c.unread_count && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-card">
            {c.unread_count > 99 ? '99+' : c.unread_count}
          </span>
        )}
      </div>
      <div className="relative z-[1] min-w-0 flex-1 pointer-events-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold truncate flex items-center gap-1 native:text-[16px] native:font-bold">
            {pinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
            {c.other_user?.display_name || c.other_user?.username || 'User'}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 native:text-[12px] native:font-medium">
            {c.last_message_at &&
              (native ? listTime(c.last_message_at) : formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false }))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-xs text-muted-foreground truncate native:mt-0.5 native:text-[14px]', !!c.unread_count && 'native:font-semibold native:text-foreground')}>
            {previewText(c.last_message)}
          </p>
          {!native && !!c.unread_count && (
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
            className="relative z-[2] h-8 w-8 shrink-0 grid place-items-center rounded-full text-muted-foreground opacity-0 native:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity data-[state=open]:opacity-100"
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
  const [listTab, setListTab] = useState<'chats' | 'calls'>('chats')
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

  const native = isNativeApp()
  const newMessage = (
    <Dialog open={newOpen} onOpenChange={setNewOpen}>
      <DialogTrigger asChild>
        {native ? (
          <button
            type="button"
            aria-label="New message"
            className="flex size-14 items-center justify-center rounded-2xl text-[#0B1F0B] shadow-xl transition-transform active:scale-95"
            style={{ backgroundImage: GOLD_GRADIENT }}
          >
            <MessageSquarePlus className="size-6" />
          </button>
        ) : (
          <Button size="icon" variant="ghost" aria-label="New message">
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <NewMessageDialog onClose={() => setNewOpen(false)} />
    </Dialog>
  )

  return (
    <>
      <SEO title="Your Messages" description="View and manage your private conversations on AbiaConnect." path="/messages" />
    <div className={cn('container mx-auto px-0 md:px-4 py-0 md:py-6', isNativeApp() && conversationId && 'h-full max-w-full p-0', isNativeApp() && !conversationId && '-mx-4 -mt-4 -mb-28 !w-auto !max-w-none')}>
      <div className={cn('md:rounded-2xl md:border md:bg-card overflow-hidden flex bg-gradient-to-b from-background to-muted/30 transition-[height] duration-150', isNativeApp() && conversationId ? 'h-full md:h-[calc(100vh-8rem)]' : isNativeApp() ? 'h-[calc(100dvh-var(--kb-inset,0px)-7.5rem-env(safe-area-inset-bottom))]' : 'h-[calc(100dvh-var(--kb-inset,0px)-3.5rem)] md:h-[calc(100vh-8rem)]')}>


        {/* LEFT */}
        <aside
          className={cn(
            'relative w-full md:w-80 border-r flex-col bg-background native:border-r-0',
            conversationId ? 'hidden md:flex' : 'flex',
          )}
        >
          {native ? (
            <div
              className="flex items-center gap-7 px-5"
              style={{ backgroundImage: APP_HEADER_GRADIENT }}
              role="tablist"
              aria-label="Messages and calls"
            >
              {(['chats', 'calls'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={listTab === tab}
                  onClick={() => setListTab(tab)}
                  className={cn(
                    'relative pb-3 pt-1 text-[17px] transition-colors',
                    listTab === tab ? 'font-extrabold text-white' : 'font-semibold text-white/60',
                  )}
                >
                  {tab === 'chats' ? 'Chats' : 'Calls'}
                  {listTab === tab && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-amber-300" aria-hidden />}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 border-b flex items-center justify-between gap-2">
              <h1 className="text-lg font-bold">Messages</h1>
              {newMessage}
            </div>
          )}
          {listTab === 'calls' ? (
            <CallHistory conversations={convosQ.data ?? []} loading={convosQ.isLoading} />
          ) : (
            <>
          <div className="p-3 border-b space-y-2 native:border-b-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="pl-9 native:h-11 native:rounded-full native:border-0 native:bg-card native:shadow-sm"
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
          <div className="flex-1 overflow-y-auto native:pb-24">
            {convosQ.isLoading ? (
              native ? (
                <ListSkeleton />
              ) : (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              )
            ) : filteredConvos.length === 0 ? (
              native && !showArchived && !search.trim() ? (
                <div className="px-8 py-12 text-center">
                  <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                    <MessageSquarePlus className="size-8" />
                  </span>
                  <p className="mt-4 text-[17px] font-bold">No chats yet</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">Say hello to someone, or find new people on Connect.</p>
                  <Button asChild className="mt-5 rounded-full">
                    <Link to="/relationship">Meet people</Link>
                  </Button>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {showArchived ? 'No archived chats.' : 'No conversations yet.'}
                </div>
              )
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
            </>
          )}
          {native && <div className="absolute bottom-4 right-4 z-10">{newMessage}</div>}
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [muteDialogOpen, setMuteDialogOpen] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Hard gate — set the instant a delete starts so realtime handlers,
  // read-acks, and queued cache writes can't resurrect a deleted chat.
  const deletingRef = useRef(false)
  // Reset the gate when switching conversations so a new chat starts clean.
  useEffect(() => {
    deletingRef.current = false
    setDeleting(false)
  }, [conversationId])
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Per-user mute state for this conversation
  const muteQ = useQuery({
    queryKey: ['conversation_state', conversationId, user?.id],
    enabled: !!conversationId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('conversation_states')
        .select('muted_until')
        .eq('conversation_id', conversationId)
        .eq('user_id', user!.id)
        .maybeSingle()
      return (data?.muted_until as string | null) ?? null
    },
  })
  const mutedUntil = muteQ.data
  const isMuted = !!mutedUntil && (mutedUntil === '9999-12-31T00:00:00+00:00' || new Date(mutedUntil) > new Date())

  const setMute = async (until: Date | null) => {
    if (!user?.id) return
    const value = until ? until.toISOString() : null
    const { error } = await supabase
      .from('conversation_states')
      .upsert(
        { conversation_id: conversationId, user_id: user.id, muted_until: value, updated_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id' },
      )
    if (error) {
      toast.error(error.message || 'Could not update mute')
      return
    }
    qc.invalidateQueries({ queryKey: ['conversation_state', conversationId, user.id] })
    toast.success(value ? 'Chat muted' : 'Chat unmuted')
  }


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
    enabled: !!conversationId && !deleting,
    queryFn: async () => {
      // If deletion started while this fetch was queued, bail out and return
      // whatever the cache already has (usually []). Never overwrite it.
      if (deletingRef.current) {
        return (qc.getQueryData<Message[]>(queryKey) ?? [])
      }
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      // The RPC race: response landed after we started deleting. Drop it.
      if (deletingRef.current) {
        return (qc.getQueryData<Message[]>(queryKey) ?? [])
      }
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
          if (deletingRef.current) return
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
          if (deletingRef.current) return
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



  // Opening a chat reads all of it, so the unread count can't get stuck on
  // messages that never scrolled into view. New arrivals are read straight
  // away while the chat is on screen.
  const markingReadRef = useRef(false)
  useEffect(() => {
    if (!user || !conversationId) return
    const uid = user.id
    const markRead = async () => {
      if (markingReadRef.current || document.visibilityState !== 'visible') return
      const list = qc.getQueryData<Message[]>(queryKey) ?? []
      if (!list.some((m) => m.sender_id !== uid && !m.is_read)) return
      markingReadRef.current = true
      const nowIso = new Date().toISOString()
      qc.setQueryData<Message[]>(queryKey, (prev) =>
        (prev ?? []).map((m) =>
          m.sender_id !== uid && !m.is_read ? { ...m, is_read: true, read_at: m.read_at ?? nowIso } : m,
        ),
      )
      qc.setQueryData<Conversation[]>(['conversations', uid], (prev) =>
        prev?.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)),
      )
      try {
        await supabase.rpc('mark_conversation_read', { _conversation_id: conversationId })
      } finally {
        markingReadRef.current = false
        qc.invalidateQueries({ queryKey: ['conversations', uid] })
        qc.invalidateQueries({ queryKey: ['messages-unread', uid] })
      }
    }
    void markRead()
    document.addEventListener('visibilitychange', markRead)
    return () => document.removeEventListener('visibilitychange', markRead)
  }, [messagesQ.data, user, conversationId, qc, queryKey])

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
          toast.error(messagingRuleText(error.message) ?? (error.message || 'Failed to send'))
          qc.invalidateQueries({ queryKey: ['conversation-send-status', conversationId] })
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

  // Group messages by day, filtered by search query when active
  const grouped = useMemo(() => {
    const groups: { date: string; items: Message[] }[] = []
    const q = searchQuery.trim().toLowerCase()
    ;(messagesQ.data ?? []).forEach((m) => {
      if (q && !(m.content ?? '').toLowerCase().includes(q)) return
      const d = new Date(m.created_at)
      const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'PPP')
      const last = groups[groups.length - 1]
      if (last && last.date === key) last.items.push(m)
      else groups.push({ date: key, items: [m] })
    })
    return groups
  }, [messagesQ.data, searchQuery])


  // First-message anti-spam: free members wait for a reply before sending more
  // (enforced by the database; this only explains it and disables Send).
  const sendStatusQ = useQuery({
    queryKey: ['conversation-send-status', conversationId, (messagesQ.data ?? []).length],
    queryFn: () => getConversationSendStatus(conversationId),
    enabled: !!conversationId,
    staleTime: 30_000,
  })
  const awaitingReply = sendStatusQ.data?.can_send === false
  const canSend = (!!draft.trim() || !!pendingFile) && !awaitingReply
  const messageById = useMemo(() => {
    const map = new Map<string, Message>()
    ;(messagesQ.data ?? []).forEach((m) => map.set(m.id, m))
    return map
  }, [messagesQ.data])

  const native = isNativeApp()
  const otherName = other?.display_name || other?.username || 'user'
  const toolClass = (tone: string) => (native ? cn('h-11 w-11 rounded-2xl transition-transform active:scale-90', tone) : undefined)
  const toolButtons = (
    <>
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
            className={toolClass('bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-300')}
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          {user && (
            <VoiceRecorderButton
              disabled={!conversationId}
              className={toolClass('bg-violet-500/15 text-violet-600 hover:bg-violet-500/25 dark:text-violet-300')}
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={toolClass('bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-300')}
                aria-label="Add emoji"
              >
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
    </>
  )
  return (
    <>
      <div
        className={cn(
          'sticky top-0 z-10 border-b border-border backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_0_hsl(var(--border))]',
          native
            ? 'bg-card pt-[max(0,env(safe-area-inset-top))]'
            : 'bg-background/85 supports-[backdrop-filter]:bg-background/70',
        )}
      >
        <div className="px-3 md:px-4 py-2.5 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={'md:hidden -ml-1 rounded-full'}
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar profile={other} size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className={'font-semibold text-sm truncate flex items-center gap-1.5 native:text-[16px] native:font-bold'}>
            <span className="truncate">{other?.display_name || other?.username || 'Conversation'}</span>
            {isMuted && <BellOff className={cn('h-3.5 w-3.5 shrink-0', 'text-muted-foreground')} aria-label="Muted" />}
          </p>
          {otherTyping ? (
            <p className={cn('text-[11px] truncate flex items-center gap-1', 'text-emerald-600 dark:text-emerald-400')}>
              <span className="inline-flex gap-0.5" aria-hidden>
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
              </span>
              typing…
            </p>
          ) : other?.username ? (
            <p className={cn('text-[11px] truncate', 'text-muted-foreground')}>@{other.username}</p>
          ) : null}
        </div>
        {other?.id && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'rounded-full active:scale-95 transition-transform',
                )}
                aria-label="More options"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={6}
              className={cn(
                'w-56 p-1 rounded-xl',
              )}
            >
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                  'hover:bg-muted',
                )}
                onClick={() => {
                  setSearchOpen(true)
                  setSearchQuery('')
                }}
              >
                <Search className="h-4 w-4 opacity-80" /> Search
              </button>
              {isMuted ? (
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                    'hover:bg-muted',
                  )}
                  onClick={() => setMute(null)}
                >
                  <Bell className="h-4 w-4 opacity-80" /> Unmute
                </button>
              ) : (
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                    'hover:bg-muted',
                  )}
                  onClick={() => setMuteDialogOpen(true)}
                >
                  <BellOff className="h-4 w-4 opacity-80" /> Mute
                </button>
              )}
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                  'hover:bg-muted',
                )}
                onClick={() => setClearDialogOpen(true)}
              >
                <Archive className="h-4 w-4 opacity-80" /> Clear history
              </button>
              <div className={cn('my-1 h-px', 'bg-border')} />
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                  'text-destructive hover:bg-destructive/10',
                )}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete chat
              </button>
            </PopoverContent>
          </Popover>
        )}
        </div>
        {searchOpen && (
          <div className={cn('px-3 md:px-4 pb-2 flex items-center gap-2', 'bg-background/85 native:bg-card')}>
            <Search className={cn('h-4 w-4', 'text-muted-foreground')} />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this chat…"
              className={cn(
                'h-8 flex-1 border-0 shadow-none focus-visible:ring-0 px-1',
              )}
            />
            <Button
              variant="ghost"
              size="icon"
              className={'h-7 w-7 rounded-full'}
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery('')
              }}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={muteDialogOpen} onOpenChange={setMuteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mute notifications</AlertDialogTitle>
            <AlertDialogDescription>
              You won't be notified about new messages in this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {([
              { label: 'For 1 hour', hours: 1 },
              { label: 'For 8 hours', hours: 8 },
              { label: 'For 1 week', hours: 24 * 7 },
              { label: 'Always', hours: null },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                type="button"
                className="w-full rounded-md border px-3 py-2.5 text-sm text-left hover:bg-muted"
                onClick={() => {
                  const until = opt.hours == null
                    ? new Date('9999-12-31T00:00:00Z')
                    : new Date(Date.now() + opt.hours * 3600 * 1000)
                  setMute(until)
                  setMuteDialogOpen(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages in this chat will be removed for you. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const { error } = await supabase.rpc('clear_conversation', { _conversation_id: conversationId })
                if (error) toast.error(error.message || 'Could not clear')
                else {
                  toast.success('Chat cleared')
                  qc.invalidateQueries({ queryKey })
                }
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation with {other?.display_name || other?.username || 'this user'} will be removed from your inbox. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault()
                if (deleting) return
                // Flip the hard gate BEFORE anything async so realtime handlers
                // and any in-flight queryFn resolutions can't write to the cache
                // between here and the RPC returning.
                deletingRef.current = true
                setDeleting(true)
                // Abort any in-flight message fetches for this chat.
                await qc.cancelQueries({ queryKey })
                // Snapshot the current inbox so we can roll back on failure.
                const inboxKey = ['conversations', user?.id]
                const unreadKey = ['messages-unread', user?.id]
                const prevInbox = qc.getQueryData<any[]>(inboxKey)
                // Optimistic UI: remove from inbox + clear this chat's messages.
                if (Array.isArray(prevInbox)) {
                  qc.setQueryData(
                    inboxKey,
                    prevInbox.filter((c: any) => c?.id !== conversationId),
                  )
                }
                qc.setQueryData(queryKey, [])

                const { error } = await supabase.rpc('delete_conversation', {
                  _conversation_id: conversationId,
                })
                if (error) {
                  // Roll back optimistic changes and surface the failure.
                  deletingRef.current = false
                  if (prevInbox !== undefined) qc.setQueryData(inboxKey, prevInbox)
                  qc.invalidateQueries({ queryKey })
                  qc.invalidateQueries({ queryKey: inboxKey })
                  setDeleting(false)
                  toast.error(error.message || 'Could not delete chat')
                  return
                }
                // Drop the messages cache entirely so a revisit refetches clean.
                qc.removeQueries({ queryKey })
                // Refresh inbox ordering + unread badges immediately so the
                // list stays consistent after deletion.
                await Promise.all([
                  qc.refetchQueries({ queryKey: inboxKey, exact: true }),
                  qc.invalidateQueries({ queryKey: unreadKey }),
                ])
                setDeleteDialogOpen(false)
                toast.success('Chat deleted')
                onBack()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>



      {native && <ChatSafetyNote />}

      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-5',
        )}
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
                'bg-primary text-primary-foreground ring-1 ring-primary/40',
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
                      'bg-primary-foreground text-primary',
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




      {awaitingReply && (
        <div
          role="status"
          className="mx-3 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground"
        >
          {t('chat.awaiting_reply_banner')}{' '}
          {canPurchaseHere() && (
            <Link to="/relationship/premium" className="font-semibold underline underline-offset-2">
              Premium members can follow up anytime.
            </Link>
          )}
        </div>
      )}
      <form
        onSubmit={handleSend}
        className={cn(
          'sticky bottom-0 z-10 p-3 border-t border-border backdrop-blur-xl space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          native
            ? 'bg-card'
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
          {!native && toolButtons}
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
            className="native:min-h-[46px] native:rounded-3xl native:border-0 native:bg-muted native:px-4 native:py-3 native:text-[15px] resize-none min-h-[40px] max-h-32 rounded-2xl bg-background text-foreground placeholder:text-muted-foreground border border-input focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            className="native:size-[46px] native:bg-[#14532D] native:text-white rounded-full shadow-md active:scale-95 transition-transform disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {native && (
          // While recording a voice note, its controls take the whole row.
          <div className="flex items-center justify-between gap-1 [.kb-open_&]:hidden [&:has([role=status])>*:not([role=status])]:hidden">
            {toolButtons}
            {other?.id && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={toolClass('bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300')}
                  aria-label={`Voice call ${otherName}`}
                  onClick={() => startCallWith(other, conversationId, false)}
                >
                  <Phone className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={toolClass('bg-pink-500/15 text-pink-600 hover:bg-pink-500/25 dark:text-pink-300')}
                  aria-label={`Video call ${otherName}`}
                  onClick={() => startCallWith(other, conversationId, true)}
                >
                  <Video className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        )}
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
//   `[call:ended:video] 42s` / `[call:missed:video] …` -> the same for video calls
//
// `parseCallLog` returns null for regular chat messages so the normal bubble
// path is used.
export type CallLogInfo =
  | { kind: 'ended'; durationSec: number; video: boolean }
  | { kind: 'missed'; reason: string; video: boolean }

/** Conversation-list preview: readable text for call-log entries. */
function previewText(content: string | null | undefined): string {
  if (!content) return 'No messages yet'
  const call = parseCallLog(content)
  if (!call) return content
  const kind = call.video ? 'Video call' : 'Voice call'
  return call.kind === 'missed' ? `Missed ${kind.toLowerCase()}` : `${kind} · ${formatCallDuration(call.durationSec)}`
}

export function parseCallLog(content: string | null | undefined): CallLogInfo | null {
  if (!content) return null
  const ended = /^\[call:ended(:video)?\]\s+(\d+)s\s*$/i.exec(content)
  if (ended) return { kind: 'ended', durationSec: parseInt(ended[2], 10) || 0, video: !!ended[1] }
  const missed = /^\[call:missed(:video)?\]\s*(.*)$/i.exec(content)
  if (missed) return { kind: 'missed', reason: missed[2]?.trim() || 'No answer', video: !!missed[1] }
  return null
}

function formatCallDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** How a call entry reads, from the point of view of whoever is looking at it. */
export function describeCall(info: CallLogInfo, mine: boolean) {
  const isMissed = info.kind === 'missed'
  const kind = info.video ? 'video call' : 'voice call'
  return {
    Icon: isMissed ? PhoneMissed : mine ? PhoneOutgoing : PhoneIncoming,
    tone: isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
    label: isMissed
      ? mine ? 'Cancelled call' : `Missed ${kind}`
      : mine ? `Outgoing ${kind}` : `Incoming ${kind}`,
    detail: info.kind === 'ended' ? formatCallDuration(info.durationSec) : info.reason,
  }
}

async function startCallWith(other: Profile, conversationId: string, video: boolean) {
  try {
    await callManager.startCall(
      {
        id: other.id!,
        name: other.display_name || other.username || 'User',
        avatarUrl: other.avatar_url ?? null,
        conversationId,
      },
      { video },
    )
  } catch (e) {
    toast.error((e as Error).message || 'Could not start the call')
  }
}

/** The app's Calls tab: every call in the member's chats, newest first. */
function CallHistory({ conversations, loading }: { conversations: Conversation[]; loading: boolean }) {
  const { user } = useAuth()
  const ids = useMemo(() => conversations.map((c) => c.id), [conversations])
  const callsQ = useQuery({
    queryKey: ['call-history', user?.id, ids.length],
    enabled: !!user && ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .in('conversation_id', ids)
        .like('content', '[call:%')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Array<Pick<Message, 'id' | 'conversation_id' | 'sender_id' | 'content' | 'created_at'>>
    },
  })

  if (loading || (ids.length > 0 && callsQ.isPending)) return <ListSkeleton />
  if (callsQ.isError) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Couldn't load your calls. Please try again.</p>
  }
  if (!callsQ.data?.length) {
    return (
      <div className="px-8 py-12 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <Phone className="size-8" />
        </span>
        <p className="mt-4 text-[17px] font-bold">No calls yet</p>
        <p className="mt-1 text-[14px] text-muted-foreground">Open a chat and tap the phone or video button to call.</p>
      </div>
    )
  }

  return (
    <ul className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-24 pt-3">
      {callsQ.data.map((row) => {
        const info = parseCallLog(row.content)
        const convo = conversations.find((c) => c.id === row.conversation_id)
        if (!info || !convo) return null
        const other = convo.other_user
        const { Icon, tone, label, detail } = describeCall(info, row.sender_id === user?.id)
        const name = other?.display_name || other?.username || 'User'
        const CallBack = info.video ? Video : Phone
        return (
          <li key={row.id} className="relative flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <Link to={`/messages/${convo.id}`} className="absolute inset-0" aria-label={`Open chat with ${name}`} />
            <Avatar profile={other} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold">{name}</p>
              <p className={cn('mt-0.5 flex items-center gap-1 text-[13px] font-semibold', tone)}>
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {detail} · {format(new Date(row.created_at), 'MMM d, p')}
              </p>
            </div>
            {other?.id && (
              <button
                type="button"
                onClick={() => startCallWith(other, convo.id, info.video)}
                aria-label={`Call ${name} back`}
                className="relative flex size-12 shrink-0 items-center justify-center rounded-full text-[#0B1F0B] shadow-md transition-transform active:scale-90"
                style={{ backgroundImage: GOLD_GRADIENT }}
              >
                <CallBack className="size-5" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5 px-3 pt-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[80px] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

const SAFETY_NOTE_KEY = 'abia:chat-safety-dismissed'

/** A short safety reminder at the top of chats, until the member closes it. */
function ChatSafetyNote() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(SAFETY_NOTE_KEY) === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <div className="mx-3 mt-2 flex items-start gap-2.5 rounded-2xl bg-amber-500/15 px-3 py-2.5 text-[13px] leading-snug text-amber-900 dark:text-amber-200">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">Stay safe: never send money or bank details to someone you haven't met.</p>
      <button
        type="button"
        aria-label="Hide safety note"
        className="-m-1 grid size-7 shrink-0 place-items-center rounded-full"
        onClick={() => {
          setHidden(true)
          try {
            localStorage.setItem(SAFETY_NOTE_KEY, '1')
          } catch {
            /* private mode: it just comes back next visit */
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function listTime(iso: string) {
  const d = new Date(iso)
  return isToday(d) ? format(d, 'p') : format(d, 'MMM d')
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
  const { Icon, tone, label, detail } = describeCall(info, mine)

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
  reactions = [],
  onToggleReaction,
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
  reactions?: ReactionAgg[]
  onToggleReaction?: (emoji: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  const deleted = !!m.deleted_for_everyone
  const editable = canEdit(m, userId)
  const deletable = canDeleteForEveryone(m, userId)

  const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏']

  const startLongPress = () => {
    if (deleted) return
    longPressFiredRef.current = false
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true
      setPickerOpen(true)
      try {
        if ('vibrate' in navigator) navigator.vibrate?.(15)
      } catch {
        /* noop */
      }
    }, 380)
  }
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }


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
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!deleted) setPickerOpen(true)
        }}
        className={cn(
          'relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm space-y-1.5 shadow-sm ring-1 select-none',
          native
            ? mine
              ? 'bg-gradient-to-br from-[#1F7A45] to-[#14532D] text-white rounded-br-md ring-transparent text-[15px]'
              : 'bg-card text-foreground rounded-bl-md ring-border/60 text-[15px]'
            : mine
              ? 'bubble-mine bg-secondary text-secondary-foreground rounded-br-md ring-secondary/30'
              : 'bg-card text-foreground rounded-bl-md ring-border/60',
          m._optimistic && 'opacity-70',
          deleted && 'italic opacity-70',
        )}
      >
        {/* Quick reaction picker — appears on long-press / right-click.
            A transparent full-screen backdrop closes it on outside tap. */}
        {pickerOpen && (
          <>
            <button
              type="button"
              aria-label="Close reactions"
              onClick={() => setPickerOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-transparent"
            />
            <div
              role="menu"
              className={cn(
                'absolute z-50 -top-12 flex items-center gap-1 rounded-full px-2 py-1.5 shadow-xl ring-1 animate-in fade-in zoom-in-95 duration-150',
                mine ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
                'bg-popover text-popover-foreground ring-border',
              )}
            >
              {QUICK_REACTIONS.map((emoji) => {
                const active = reactions.some((r) => r.emoji === emoji && r.mine)
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction?.(emoji)
                      setPickerOpen(false)
                    }}
                    className={cn(
                      'grid place-items-center w-9 h-9 rounded-full text-xl leading-none transition-transform active:scale-90 hover:scale-110',
                      active && 'bg-muted',
                    )}
                    aria-label={active ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          </>
        )}


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
              native && mine
                ? 'bg-black/25 border-emerald-300/70 text-white/90 hover:bg-black/35 active:bg-black/45'
                : mine
                  ? 'bg-secondary-foreground/10 border-secondary-foreground/40 hover:bg-secondary-foreground/15'
                  : 'bg-muted border-primary/60 hover:bg-muted/80',
            )}
            aria-label="Jump to quoted message"
          >
            <p className={cn('font-semibold text-[11px] mb-0.5', native ? (mine ? 'text-emerald-200' : 'text-primary') : 'opacity-80')}>
              {quoted.sender_id === userId ? 'You' : otherName}
            </p>
            <p className={cn('truncate', native && mine ? 'text-white/70' : 'opacity-80')}>{messagePreview(quoted)}</p>
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
              className={cn(m.is_read && (native && mine ? 'text-sky-300' : 'text-sky-500'))}
            >
              {m.is_read || m._status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </p>

        {/* Reaction chips — overlap the bottom edge of the bubble, WhatsApp-style. */}
        {reactions.length > 0 && !deleted && (
          <div
            className={cn(
              'absolute -bottom-3 flex items-center gap-1',
              mine ? 'right-2' : 'left-2',
            )}
          >
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction?.(r.emoji)}
                aria-label={r.mine ? `Remove your ${r.emoji} reaction` : `Add ${r.emoji} reaction`}
                aria-pressed={r.mine}
                className={cn(
                  'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none shadow-sm ring-1 transition-transform active:scale-90 hover:scale-105',
                  r.mine
                      ? 'bg-primary text-primary-foreground ring-primary/40'
                      : 'bg-background text-foreground ring-border',
                )}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="font-semibold">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
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
            'h-7 w-7 grid place-items-center rounded-full text-muted-foreground opacity-0 native:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity data-[state=open]:opacity-100 shrink-0',
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
