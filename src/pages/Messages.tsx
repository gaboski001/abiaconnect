import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ArrowLeft, MessageSquarePlus, Search, Send, Loader2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'

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
  content: string
  created_at: string
  is_read?: boolean
  _optimistic?: boolean
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
          lastMap[m.conversation_id] = { content: m.content, created_at: m.created_at }
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

  // Realtime
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
        () => qc.invalidateQueries({ queryKey }),
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

  // Mark incoming messages as read
  useEffect(() => {
    if (!user || !messagesQ.data?.length) return
    const hasUnread = messagesQ.data.some((m) => !m.is_read && m.sender_id !== user.id)
    if (!hasUnread) return
    supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)
      .then(() => qc.invalidateQueries({ queryKey: ['conversations', user.id] }))
  }, [messagesQ.data, user, conversationId, qc])

  const sendMut = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      })
      if (error) throw error
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    },
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<Message[]>(queryKey) ?? []
      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: user!.id,
        content,
        created_at: new Date().toISOString(),
        _optimistic: true,
      }
      qc.setQueryData<Message[]>(queryKey, [...prev, optimistic])
      return { prev }
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
      toast.error(e.message || 'Failed to send')
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })

  const handleSend = (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sendMut.isPending) return
    setDraft('')
    sendMut.mutate(text)
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
                return (
                  <div
                    key={m.id}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                        mine
                          ? 'bg-secondary text-secondary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm',
                        m._optimistic && 'opacity-70',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p
                        className={cn(
                          'text-[10px] mt-1 opacity-70',
                          mine ? 'text-right' : 'text-left',
                        )}
                      >
                        {format(new Date(m.created_at), 'p')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t flex items-end gap-2">
        <Textarea
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
        <Button type="submit" size="icon" disabled={!draft.trim() || sendMut.isPending}>
          {sendMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
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
      const { data, error } = await (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> })
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
