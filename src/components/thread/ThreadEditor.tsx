import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import DOMPurify from 'dompurify'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  Heading2, Heading3, Quote, List, ListOrdered, Minus,
  Image as ImageIcon, Upload, Plus, Loader2,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { compressToWebp } from '@/lib/imageCompress'
import { deleteAttachmentPaths, extractAttachmentPaths } from '@/lib/threadAttachments'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  autoFocus?: boolean
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Rich thread editor built on Tiptap.
 * - Real block model (paragraphs, headings, lists, quote, hr, images).
 * - Medium-style bubble menu on selection; "+" side menu on empty lines.
 * - Drag/drop + paste image → WebP → upload → inline insert with alignment.
 * - Session upload paths are auto-purged if the composer is discarded or an
 *   image is removed from the doc (matches the existing thread-attachments flow).
 */
export function ThreadEditor({
  value, onChange, placeholder = 'Tell your story… Use the "+" on the left to add an image or heading.',
  minHeight = 320, autoFocus,
}: Props) {
  const { user } = useAuth()
  const uploadedPathsRef = useRef<Set<string>>(new Set())
  const submittedRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { HTMLAttributes: { class: 'te-code' } },
        blockquote: { HTMLAttributes: { class: 'te-quote' } },
        horizontalRule: { HTMLAttributes: { class: 'te-hr' } },
      }),
      Underline,
      Typography,
      Placeholder.configure({ placeholder, showOnlyWhenEditable: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener nofollow ugc', target: '_blank', class: 'te-link' },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'te-img' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
    ],
    content: value || '',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'thread-prose focus:outline-none px-4 sm:px-6 py-5',
        style: `min-height:${minHeight}px`,
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (!files.length) return false
        event.preventDefault()
        void uploadFiles(files)
        return true
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? [])
        const image = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
        if (!image) return false
        const file = image.getAsFile()
        if (!file) return false
        event.preventDefault()
        void uploadFiles([file])
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = DOMPurify.sanitize(e.getHTML(), {
        ADD_ATTR: ['target', 'rel'],
      })
      onChange(html)

      if (uploadedPathsRef.current.size) {
        const stillPresent = new Set(extractAttachmentPaths(html))
        const orphaned: string[] = []
        uploadedPathsRef.current.forEach((p) => {
          if (!stillPresent.has(p)) orphaned.push(p)
        })
        if (orphaned.length) {
          orphaned.forEach((p) => uploadedPathsRef.current.delete(p))
          void deleteAttachmentPaths(orphaned)
        }
      }
    },
  })

  // Keep external value → editor content in sync when parent resets (e.g. after post).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    // Empty parent reset ⇒ clear and mark submitted so unmount cleanup is skipped.
    if (value === '' && current !== '<p></p>' && current !== '') {
      editor.commands.clearContent()
      submittedRef.current = true
      uploadedPathsRef.current.clear()
    }
  }, [value, editor])

  // Best-effort cleanup on unmount if the composer is abandoned.
  useEffect(() => {
    return () => {
      if (submittedRef.current) return
      const paths = [...uploadedPathsRef.current]
      if (paths.length) void deleteAttachmentPaths(paths)
    }
  }, [])

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!editor) return
    if (!user) { toast.error('Please sign in'); return }
    setUploading(true)
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) { toast.error(`${file.name}: unsupported format`); continue }
      if (file.size > MAX_BYTES) { toast.error(`${file.name}: over 5 MB`); continue }
      const t = toast.loading(`Optimizing ${file.name}…`)
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
        editor.chain().focus().setImage({ src: signed.signedUrl, alt: file.name }).createParagraphNear().run()
        toast.dismiss(t)
        const saved = converted ? ` · ${Math.round((1 - outFile.size / file.size) * 100)}% smaller` : ''
        toast.success(`Inserted${saved}`)
      } catch (err) {
        toast.dismiss(t)
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      }
    }
    setUploading(false)
  }, [editor, user])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) void uploadFiles(files)
  }

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL (leave empty to remove)', prev ?? 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    try {
      const u = new URL(url)
      if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) throw new Error()
      editor.chain().focus().extendMarkRange('link').setLink({ href: u.toString() }).run()
    } catch { toast.error('Please enter a valid URL') }
  }, [editor])

  const insertByUrl = () => {
    if (!editor) return
    const url = window.prompt('Paste image URL')
    if (!url) return
    try {
      const u = new URL(url)
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
      editor.chain().focus().setImage({ src: u.toString() }).createParagraphNear().run()
    } catch { toast.error('Please enter a valid http(s) URL') }
  }

  if (!editor) {
    return (
      <div className="rounded-2xl border border-input bg-card animate-pulse" style={{ minHeight }} />
    )
  }

  return (
    <div className="thread-editor rounded-2xl border border-input bg-card shadow-sm overflow-hidden">
      {/* Bubble menu — appears when text is selected */}
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top', offset: 8 }}
        shouldShow={({ editor: e, from, to }) => !e.state.selection.empty && from !== to && !e.isActive('image')}
        className="te-bubble"
      >
        <TB active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold className="size-3.5" /></TB>
        <TB active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic className="size-3.5" /></TB>
        <TB active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline"><UnderlineIcon className="size-3.5" /></TB>
        <span className="te-sep" />
        <TB active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading"><Heading2 className="size-3.5" /></TB>
        <TB active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Subheading"><Heading3 className="size-3.5" /></TB>
        <TB active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote"><Quote className="size-3.5" /></TB>
        <TB active={editor.isActive('link')} onClick={setLink} label="Link"><LinkIcon className="size-3.5" /></TB>
      </BubbleMenu>

      {/* Image bubble — alignment controls when an image is selected */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, placement: 'top' }}
        shouldShow={({ editor: e }) => e.isActive('image')}
        className="te-bubble"
      >
        <TB active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} label="Align left"><AlignLeft className="size-3.5" /></TB>
        <TB active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} label="Align center"><AlignCenter className="size-3.5" /></TB>
        <TB active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} label="Align right"><AlignRight className="size-3.5" /></TB>
      </BubbleMenu>

      {/* Floating "+" menu on empty lines */}
      <FloatingMenu
        editor={editor}
        tippyOptions={{ duration: 120, placement: 'left-start', offset: [0, 12] }}
        shouldShow={({ editor: e, state }) => {
          const { $from } = state.selection
          const isEmptyParagraph = $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
          return isEmptyParagraph && !e.isActive('image')
        }}
        className="te-floating"
      >
        <PlusMenu
          onImage={() => fileInputRef.current?.click()}
          onImageUrl={insertByUrl}
          onHeading={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          onQuote={() => editor.chain().focus().toggleBlockquote().run()}
          onBullet={() => editor.chain().focus().toggleBulletList().run()}
          onNumber={() => editor.chain().focus().toggleOrderedList().run()}
          onRule={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </FloatingMenu>

      <EditorContent editor={editor} />

      {/* Persistent bottom action bar — always visible so mobile users know
          how to add media without discovering the "+" affordance. */}
      <div className="flex items-center gap-1 border-t border-border/60 bg-muted/30 px-2 py-1.5">
        <ToolbarBtn onClick={() => fileInputRef.current?.click()} disabled={uploading} label="Upload image">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          <span className="hidden sm:inline text-xs font-medium">Upload</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={insertByUrl} label="Insert image URL"><ImageIcon className="size-4" /><span className="hidden sm:inline text-xs">URL</span></ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading"><Heading2 className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote"><Quote className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list"><List className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list"><ListOrdered className="size-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Divider"><Minus className="size-4" /></ToolbarBtn>
        <div className="ml-auto text-xs text-muted-foreground pr-2">
          {editor.storage.characterCount?.characters?.() ?? editor.getText().length} chars
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  )
}

function TB({ children, active, onClick, label }: { children: React.ReactNode; active?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition ${active ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-foreground/10'}`}
    >{children}</button>
  )
}

function ToolbarBtn({ children, active, onClick, disabled, label }: { children: React.ReactNode; active?: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-foreground/80 hover:bg-foreground/10 disabled:opacity-50 disabled:pointer-events-none ${active ? 'bg-foreground/10 text-foreground' : ''}`}
    >{children}</button>
  )
}

function PlusMenu({
  onImage, onImageUrl, onHeading, onQuote, onBullet, onNumber, onRule,
}: {
  onImage: () => void; onImageUrl: () => void; onHeading: () => void; onQuote: () => void;
  onBullet: () => void; onNumber: () => void; onRule: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Insert block"
        onClick={() => setOpen((v) => !v)}
        className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-card text-foreground/70 hover:text-foreground hover:border-foreground/40 shadow-sm"
      >
        <Plus className={`size-4 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-9 top-0 flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1 shadow-md">
          <TB onClick={() => { onImage(); setOpen(false) }} label="Upload image"><Upload className="size-3.5" /></TB>
          <TB onClick={() => { onImageUrl(); setOpen(false) }} label="Image URL"><ImageIcon className="size-3.5" /></TB>
          <span className="te-sep" />
          <TB onClick={() => { onHeading(); setOpen(false) }} label="Heading"><Heading2 className="size-3.5" /></TB>
          <TB onClick={() => { onQuote(); setOpen(false) }} label="Quote"><Quote className="size-3.5" /></TB>
          <TB onClick={() => { onBullet(); setOpen(false) }} label="Bulleted list"><List className="size-3.5" /></TB>
          <TB onClick={() => { onNumber(); setOpen(false) }} label="Numbered list"><ListOrdered className="size-3.5" /></TB>
          <TB onClick={() => { onRule(); setOpen(false) }} label="Divider"><Minus className="size-3.5" /></TB>
        </div>
      )}
    </div>
  )
}

// Expose editor ref for future callers if needed
export type { Editor }
