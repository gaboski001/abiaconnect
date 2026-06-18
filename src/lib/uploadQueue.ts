// Lightweight in-memory upload queue for chat attachments.
// - Non-blocking: enqueue returns immediately, chat input stays free.
// - Auto-retries with exponential backoff (max 4 attempts).
// - Emits progress events for real-time UI.
// - One worker per conversation, so uploads in different chats run in parallel.

import { supabase } from '@/lib/supabase'
import { ATTACHMENT_TTL_HOURS, isImage } from '@/lib/chatAttachments'

export type QueueStatus = 'queued' | 'uploading' | 'sending' | 'done' | 'error'

export interface QueueItem {
  id: string
  conversationId: string
  senderId: string
  content: string
  file: File | null
  previewUrl: string | null
  status: QueueStatus
  progress: number // 0-100
  attempt: number
  error?: string
  createdAt: number
}

type Listener = (items: QueueItem[]) => void

const MAX_ATTEMPTS = 4

class UploadQueue {
  private items: QueueItem[] = []
  private listeners = new Set<Listener>()
  private workers = new Map<string, boolean>() // conversationId -> running

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.items)
    return () => this.listeners.delete(fn)
  }

  itemsFor(conversationId: string) {
    return this.items.filter((i) => i.conversationId === conversationId)
  }

  enqueue(input: {
    conversationId: string
    senderId: string
    content: string
    file: File | null
  }) {
    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId: input.conversationId,
      senderId: input.senderId,
      content: input.content,
      file: input.file,
      previewUrl: input.file && isImage(input.file) ? URL.createObjectURL(input.file) : null,
      status: 'queued',
      progress: 0,
      attempt: 0,
      createdAt: Date.now(),
    }
    this.items.push(item)
    this.emit()
    this.tick(input.conversationId)
    return item.id
  }

  retry(id: string) {
    const item = this.items.find((i) => i.id === id)
    if (!item || item.status !== 'error') return
    item.status = 'queued'
    item.error = undefined
    item.attempt = 0
    item.progress = 0
    this.emit()
    this.tick(item.conversationId)
  }

  remove(id: string) {
    const item = this.items.find((i) => i.id === id)
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    this.items = this.items.filter((i) => i.id !== id)
    this.emit()
  }

  private emit() {
    const snapshot = [...this.items]
    this.listeners.forEach((l) => l(snapshot))
  }

  private update(id: string, patch: Partial<QueueItem>) {
    const i = this.items.find((x) => x.id === id)
    if (!i) return
    Object.assign(i, patch)
    this.emit()
  }

  private async tick(conversationId: string) {
    if (this.workers.get(conversationId)) return
    this.workers.set(conversationId, true)
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = this.items.find(
          (i) => i.conversationId === conversationId && i.status === 'queued',
        )
        if (!next) break
        await this.process(next)
      }
    } finally {
      this.workers.set(conversationId, false)
    }
  }

  private async process(item: QueueItem) {
    item.attempt += 1
    try {
      let attachment_url: string | null = null
      let attachment_path: string | null = null
      let attachment_type: string | null = null
      let attachment_name: string | null = null
      let attachment_size: number | null = null
      let attachment_expires_at: string | null = null

      if (item.file) {
        this.update(item.id, { status: 'uploading', progress: 5 })
        const ext = item.file.name.split('.').pop() || 'bin'
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `${item.conversationId}/${safeName}`
        const { error: upErr } = await supabase.storage
          .from('chat-attachments')
          .upload(path, item.file, { contentType: item.file.type, upsert: false })
        if (upErr) throw upErr
        this.update(item.id, { progress: 70 })
        const { data: signed, error: signErr } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(path, 60 * 60 * ATTACHMENT_TTL_HOURS)
        if (signErr) throw signErr
        attachment_url = signed.signedUrl
        attachment_path = path
        attachment_type = item.file.type
        attachment_name = item.file.name
        attachment_size = item.file.size
        attachment_expires_at = new Date(
          Date.now() + ATTACHMENT_TTL_HOURS * 60 * 60 * 1000,
        ).toISOString()
      }

      this.update(item.id, { status: 'sending', progress: 90 })
      const { error } = await supabase.from('messages').insert({
        conversation_id: item.conversationId,
        sender_id: item.senderId,
        content: item.content || null,
        attachment_url,
        attachment_path,
        attachment_type,
        attachment_name,
        attachment_size,
        attachment_expires_at,
      })
      if (error) throw error
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item.conversationId)

      this.update(item.id, { status: 'done', progress: 100 })
      // Drop from queue shortly after; Realtime will surface the real message.
      setTimeout(() => this.remove(item.id), 400)
    } catch (e: any) {
      const msg = e?.message || 'Upload failed'
      if (item.attempt < MAX_ATTEMPTS) {
        const backoff = Math.min(8000, 500 * 2 ** (item.attempt - 1))
        this.update(item.id, {
          status: 'queued',
          progress: 0,
          error: `${msg} — retrying (${item.attempt}/${MAX_ATTEMPTS})`,
        })
        await new Promise((r) => setTimeout(r, backoff))
      } else {
        this.update(item.id, { status: 'error', error: msg })
      }
    }
  }
}

export const uploadQueue = new UploadQueue()
