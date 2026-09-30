import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Upload } from 'lucide-react'
import DOMPurify from 'dompurify'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { compressToWebp } from '@/lib/imageCompress'
import { deleteAttachmentPaths, extractAttachmentPaths } from '@/lib/threadAttachments'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minRows?: number
  maxLength?: number
  autoFocus?: boolean
  disabled?: boolean
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Rich reply composer: contenteditable with WebP image upload to the
 * thread-attachments bucket. Removed images are purged from storage
 * on next edit; unposted images are purged on unmount.
 */
export function ReplyComposer({
  value,
  onChange,
  placeholder = 'Write a reply…',
  minRows = 4,
  maxLength = 5000,
  autoFocus,
  disabled,
}: Props) {
  const { user } = useAuth()
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadedPathsRef = useRef<Set<string>>(new Set())
  const submittedRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Sync external value → editor when caller resets (e.g. after post).
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (el.innerHTML !== value) el.innerHTML = value
  }, [value])

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus()
  }, [autoFocus])

  // Best-effort cleanup on unmount if never posted.
  useEffect(() => {
    return () => {
      if (submittedRef.current) return
      const paths = [...uploadedPathsRef.current]
      if (paths.length) void deleteAttachmentPaths(paths)
    }
  }, [])

  // Expose a "mark submitted" hook via a global-ish pattern would be ugly.
  // Instead, when value becomes empty (parent reset after successful post),
  // treat that as "submitted" for cleanup purposes.
  useEffect(() => {
    if (value === '' && uploadedPathsRef.current.size) {
      submittedRef.current = true
      uploadedPathsRef.current.clear()
    }
  }, [value])

  const sync = () => {
    const html = editorRef.current?.innerHTML ?? ''
    const clean = DOMPurify.sanitize(html).slice(0, maxLength)
    onChange(clean)

    if (uploadedPathsRef.current.size) {
      const stillPresent = new Set(extractAttachmentPaths(clean))
      const orphaned: string[] = []
      uploadedPathsRef.current.forEach((p) => {
        if (!stillPresent.has(p)) orphaned.push(p)
      })
      if (orphaned.length) {
        orphaned.forEach((p) => uploadedPathsRef.current.delete(p))
        void deleteAttachmentPaths(orphaned)
      }
    }
  }

  const insertByUrl = () => {
    const url = window.prompt('Paste image URL')
    if (!url) return
    try {
      const u = new URL(url)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
      editorRef.current?.focus()
      document.execCommand('insertImage', false, u.toString())
      sync()
    } catch {
      toast.error('Please enter a valid http(s) URL')
    }
  }

  const uploadFile = async (file: File) => {
    if (!user) { toast.error('Please sign in'); return }
    if (!ALLOWED.includes(file.type)) { toast.error('PNG, JPG, WEBP or GIF only'); return }
    if (file.size > MAX_BYTES) { toast.error('Image must be under 5 MB'); return }

    setUploading(true)
    const t = toast.loading('Optimizing & uploading…')
    try {
      const { file: outFile, converted } = await compressToWebp(file, { maxEdge: 1600, quality: 0.82 })
      const ext = outFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp'
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('thread-attachments')
        .upload(path, outFile, { contentType: outFile.type, upsert: false })
      if (upErr) throw upErr
      const { data: signed, error: signErr } = await supabase.storage
        .from('thread-attachments')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('Could not sign URL')
      uploadedPathsRef.current.add(path)
      editorRef.current?.focus()
      document.execCommand('insertImage', false, signed.signedUrl)
      sync()
      toast.dismiss(t)
      const saved = converted ? ` (${Math.round((1 - outFile.size / file.size) * 100)}% smaller)` : ''
      toast.success(`Image inserted${saved}`)
    } catch (err) {
      toast.dismiss(t)
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadFile(file)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      await uploadFile(f)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (disabled || uploading) return
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    await uploadFile(file)
  }


  return (
    <div
      className={`rounded-md border bg-background overflow-hidden transition-colors ${
        dragOver ? 'border-primary ring-2 ring-primary/30' : 'border-input'
      }`}
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setDragOver(true) }}
      onDragEnter={(e) => { if (disabled) return; e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => {
        // only clear when leaving the composer itself, not children
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDragOver(false)
      }}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-1 border-b border-input bg-muted/40 p-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={insertByUrl}
          disabled={disabled}
          aria-label="Insert image by URL"
          title="Insert image by URL"
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="Upload image"
          title="Upload image (auto-converted to WebP)"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={sync}
        onPaste={handlePaste}
        className="prose prose-sm dark:prose-invert max-w-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-b-md empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        style={{ minHeight: `${minRows * 1.5}rem` }}
        suppressContentEditableWarning
      />
    </div>
  )
}
