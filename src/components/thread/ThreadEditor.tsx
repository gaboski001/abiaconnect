import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Typography from '@tiptap/extension-typography'
import DOMPurify from 'dompurify'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  Heading2, Heading3, Quote, List, ListOrdered, Minus,
  Image as ImageIcon, Upload, Loader2, Undo2, Redo2, ChevronDown, LayoutTemplate, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { compressToWebp } from '@/lib/imageCompress'
import { deleteAttachmentPaths, extractAttachmentPaths } from '@/lib/threadAttachments'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STORY_LAYOUTS, layoutHtml, readingStats, type StoryLayout } from '@/lib/storyLayouts'
import { GuideText } from './extensions/GuideText'
import { ResizableImage } from './extensions/ResizableImage'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  autoFocus?: boolean
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024

const TEXT_STYLES = [
  { id: 'paragraph', label: 'Normal text', className: 'text-sm' },
  { id: 'h2', label: 'Section heading', className: 'font-serif text-lg font-semibold' },
  { id: 'h3', label: 'Small heading', className: 'font-serif text-base font-semibold' },
] as const
type TextStyle = (typeof TEXT_STYLES)[number]['id']

/** A typed address with "https://" added when the member left it out, or null if it is not a web address. */
function webAddress(raw: string, allowMail = false): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    const ok = allowMail ? ['http:', 'https:', 'mailto:'] : ['http:', 'https:']
    if (!ok.includes(u.protocol) || (u.protocol !== 'mailto:' && !u.hostname.includes('.'))) return null
    return u.toString()
  } catch {
    return null
  }
}

/**
 * Rich thread editor built on Tiptap.
 * - Real block model (paragraphs, headings, lists, quote, hr, images).
 * - One toolbar, grouped: layout, text style, emphasis, lists, link/picture.
 * - Ready-made layouts put headings in; grey guide text under each heading
 *   tells the member what to write and is never saved.
 * - Drag/drop + paste image → WebP → upload → inline insert with alignment.
 * - Session upload paths are auto-purged if the composer is discarded or an
 *   image is removed from the doc (matches the existing thread-attachments flow).
 */
export function ThreadEditor({
  value, onChange, placeholder = 'Start writing here…',
  minHeight = 320, autoFocus,
}: Props) {
  const { user } = useAuth()
  const uploadedPathsRef = useRef<Set<string>>(new Set())
  const submittedRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [openMenu, setOpenMenu] = useState<'layout' | 'style' | 'link' | 'image' | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { HTMLAttributes: { class: 'te-code' } },
        blockquote: { HTMLAttributes: { class: 'te-quote' } },
        horizontalRule: { HTMLAttributes: { class: 'te-hr' } },
        // Disable extensions we register standalone with custom config to
        // avoid duplicate schema registration (causes DOMSerializer null spec).
        underline: false,
        link: false,
      }),
      Underline,
      Typography,
      GuideText.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener nofollow ugc', target: '_blank', class: 'te-link' },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'te-img' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'thread-prose focus:outline-none px-4 sm:px-6 py-5',
        style: `min-height:${minHeight}px`,
        'aria-label': 'Your story',
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
    if (!editor || editor.isDestroyed || !editor.view) return
    let current = ''
    try {
      current = editor.getHTML()
    } catch {
      return
    }
    // Empty parent reset ⇒ clear and mark submitted so unmount cleanup is skipped.
    if (value === '' && current !== '<p></p>' && current !== '') {
      submittedRef.current = true
      uploadedPathsRef.current.clear()
      editor.commands.clearContent()
    }
  }, [value, editor])

  // Drafts survive navigation; never delete their uploads on unmount.
  // Removed images are cleaned up by onUpdate, not by a posting/navigation race.

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!editor) return
    if (!user) { toast.error('Please sign in'); return }
    setUploading(true)
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) { toast.error(`${file.name}: unsupported format`); continue }
      if (file.size > MAX_BYTES) { toast.error(`${file.name}: over 5 MB`); continue }
      const t = toast.loading(`Optimizing ${file.name}…`)
      try {
        const { file: outFile, converted } = await compressToWebp(file, { maxEdge: 1600, quality: 0.82, requireWebp: true })
        const ext = outFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp'
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('thread-attachments')
          .upload(path, outFile, { contentType: outFile.type, upsert: false })
        if (upErr) throw upErr
        const { data: signed, error: signErr } = await supabase.storage
          .from('thread-attachments')
          .createSignedUrl(path, 3600)
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

  // What is active where the cursor is; the toolbar redraws only when one of these changes.
  const at = useEditorState({
    editor,
    // Reads the current editor, not the one passed in: a page still loading can get its
    // unshown editor shut down, and the snapshot keeps that one until the next keystroke.
    selector: () => {
      const e = editor && !editor.isDestroyed ? editor : null
      return e && {
        empty: e.isEmpty,
        style: (e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'paragraph') as TextStyle,
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        bullet: e.isActive('bulletList'),
        numbered: e.isActive('orderedList'),
        quote: e.isActive('blockquote'),
        link: e.isActive('link'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        ...readingStats(e.getText()),
      }
    },
  })

  const toggleMenu = (menu: NonNullable<typeof openMenu>) => (open: boolean) => {
    if (open && menu === 'link') setLinkUrl((editor?.getAttributes('link').href as string | undefined) ?? '')
    if (open && menu === 'image') setImageUrl('')
    setOpenMenu(open ? menu : null)
  }

  const applyLink = () => {
    if (!editor) return
    const href = webAddress(linkUrl, true)
    if (!href) { toast.error('That does not look like a web address. Example: abiaconnect.com'); return }
    const chain = editor.chain().focus()
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing is selected, so the address itself becomes the linked text.
      chain.insertContent({ type: 'text', text: linkUrl.trim(), marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      chain.extendMarkRange('link').setLink({ href }).run()
    }
    setOpenMenu(null)
  }

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    setOpenMenu(null)
  }

  const insertImageUrl = () => {
    if (!editor) return
    const src = webAddress(imageUrl)
    if (!src) { toast.error('That does not look like a picture link. It should start with https://'); return }
    editor.chain().focus().setImage({ src }).createParagraphNear().run()
    setOpenMenu(null)
  }

  const applyStyle = (style: TextStyle) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (style === 'paragraph') chain.setParagraph().run()
    else chain.setHeading({ level: style === 'h2' ? 2 : 3 }).run()
    setOpenMenu(null)
  }

  // An empty post becomes the layout; a post already begun gets the headings added below it.
  const applyLayout = (layout: StoryLayout) => {
    if (!editor) return
    if (editor.isEmpty) {
      editor.chain().setContent(layoutHtml(layout), { emitUpdate: true }).focus('start').run()
    } else {
      editor.chain().focus('end').insertContent(layoutHtml(layout)).run()
      toast.success(`${layout.name} headings added below your text`)
    }
    setOpenMenu(null)
  }

  if (!editor || !at) {
    return (
      <div className="rounded-2xl border border-input bg-card animate-pulse" style={{ minHeight }} />
    )
  }

  const currentStyle = at.style
  // Keeps the cursor in the story when a menu closes, instead of jumping back to its button.
  const stay = (e: Event) => e.preventDefault()

  return (
    <div className="thread-editor rounded-2xl border border-input bg-card shadow-sm overflow-hidden">
      {/* Sticky formatting toolbar */}
      <div
        role="toolbar"
        aria-label="Formatting"
        className="te-toolbar sticky top-0 z-20 flex flex-wrap items-center gap-x-0.5 gap-y-1 border-b border-border/60 bg-card/95 backdrop-blur px-2 py-1.5"
      >
        <Popover open={openMenu === 'layout'} onOpenChange={toggleMenu('layout')}>
          <PopoverTrigger asChild>
            <button type="button" className={`${BTN} font-medium text-primary`} aria-label="Choose a layout">
              <LayoutTemplate className="size-4" />
              <span className="text-xs">Layout</span>
              <ChevronDown className="size-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2" onCloseAutoFocus={stay}>
            <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
              A layout gives your post ready-made headings. Grey guide text shows you what to write under each one.
            </p>
            {STORY_LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => applyLayout(l)}
                className="block w-full rounded-md px-2 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <span className="block text-sm font-semibold">{l.name}</span>
                <span className="block text-xs text-muted-foreground">{l.summary}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Sep />

        <Popover open={openMenu === 'style'} onOpenChange={toggleMenu('style')}>
          <PopoverTrigger asChild>
            <button type="button" className={`${BTN} min-w-[7.5rem] justify-between`} aria-label="Text style">
              <span className="text-xs font-medium">{TEXT_STYLES.find((s) => s.id === currentStyle)?.label}</span>
              <ChevronDown className="size-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1" onCloseAutoFocus={stay}>
            {TEXT_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applyStyle(s.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-accent hover:text-accent-foreground"
              >
                <span className={s.className}>{s.label}</span>
                {currentStyle === s.id && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Sep />

        <ToolbarBtn active={at.bold} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={at.italic} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={at.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline"><UnderlineIcon className="size-4" /></ToolbarBtn>
        <Sep />

        <ToolbarBtn active={at.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list"><List className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={at.numbered} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list"><ListOrdered className="size-4" /></ToolbarBtn>
        <ToolbarBtn active={at.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote"><Quote className="size-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Dividing line"><Minus className="size-4" /></ToolbarBtn>
        <Sep />

        <Popover open={openMenu === 'link'} onOpenChange={toggleMenu('link')}>
          <PopoverTrigger asChild>
            <button type="button" className={`${BTN} ${at.link ? BTN_ON : ''}`} aria-label="Link" title="Link">
              <LinkIcon className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-2 p-3" onCloseAutoFocus={stay}>
            <label htmlFor="te-link-url" className="text-sm font-medium">Web address</label>
            <Input
              id="te-link-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }}
              placeholder="https://"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">
              Tip: select some words first, and they become the link.
            </p>
            <div className="flex justify-end gap-2">
              {at.link && (
                <Button type="button" variant="ghost" size="sm" onClick={removeLink}>Remove link</Button>
              )}
              <Button type="button" size="sm" onClick={applyLink}>Add link</Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover open={openMenu === 'image'} onOpenChange={toggleMenu('image')}>
          <PopoverTrigger asChild>
            <button type="button" className={BTN} disabled={uploading} aria-label="Add a picture">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              <span className="text-xs font-medium">Picture</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3 p-3" onCloseAutoFocus={stay}>
            <Button
              type="button"
              className="w-full"
              onClick={() => { setOpenMenu(null); fileInputRef.current?.click() }}
            >
              <Upload className="size-4" /> Upload from this device
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF, up to 5 MB. You can also drag a picture into your story.</p>
            <div className="space-y-2 border-t border-border pt-3">
              <label htmlFor="te-image-url" className="text-sm font-medium">Or paste a picture link</label>
              <div className="flex gap-2">
                <Input
                  id="te-image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertImageUrl() } }}
                  placeholder="https://"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <Button type="button" variant="outline" onClick={insertImageUrl}>Add</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!at.canUndo} label="Undo"><Undo2 className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!at.canRedo} label="Redo"><Redo2 className="size-4" /></ToolbarBtn>
        </div>
      </div>

      {/* Shown until the member starts writing */}
      {at.empty && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/30 px-4 sm:px-6 py-2.5">
          <span className="text-xs text-muted-foreground">Not sure how to begin? Pick a layout:</span>
          {STORY_LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => applyLayout(l)}
              title={l.summary}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {/* Bubble menu — appears when text is selected */}
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top', offset: 8 }}
        shouldShow={({ editor: e, from, to }) => !e.state.selection.empty && from !== to && !e.isActive('image')}
        className="te-bubble"
      >
        <TB active={at.bold} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold className="size-3.5" /></TB>
        <TB active={at.italic} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic className="size-3.5" /></TB>
        <TB active={at.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} label="Underline"><UnderlineIcon className="size-3.5" /></TB>
        <span className="te-sep" />
        <TB active={at.style === 'h2'} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Section heading"><Heading2 className="size-3.5" /></TB>
        <TB active={at.style === 'h3'} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Small heading"><Heading3 className="size-3.5" /></TB>
        <TB active={at.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="Quote"><Quote className="size-3.5" /></TB>
        <TB active={at.link} onClick={() => toggleMenu('link')(true)} label="Link"><LinkIcon className="size-3.5" /></TB>
      </BubbleMenu>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-4 sm:px-6 py-2 text-xs text-muted-foreground">
        <span>Short paragraphs and clear headings are easiest to read.</span>
        <span className="shrink-0 tabular-nums">
          {at.words === 0 ? 'No words yet' : `${at.words} ${at.words === 1 ? 'word' : 'words'} · ${at.minutes} min read`}
        </span>
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

const BTN = 'inline-flex items-center gap-1.5 h-9 px-2 rounded-md text-foreground/80 hover:bg-foreground/10 disabled:opacity-50 disabled:pointer-events-none'
const BTN_ON = 'bg-primary/10 text-primary'

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
      aria-pressed={active}
      title={label}
      // Keeps the selection (and the phone keyboard) in place while the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`${BTN} ${active ? BTN_ON : ''}`}
    >{children}</button>
  )
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}

// Expose editor ref for future callers if needed
export type { Editor }
