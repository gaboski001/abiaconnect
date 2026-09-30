import { useCallback, useEffect, useRef, useState } from 'react'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

/**
 * Image node with drag-to-resize (width %) + inline caption.
 * Serializes as <figure><img/><figcaption/></figure> so the same markup renders
 * identically outside the editor via .thread-prose styles.
 */
export const ResizableImage = Image.extend({
  name: 'image',
  group: 'block',
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (el) => (el as HTMLElement).style.width || el.getAttribute('width') || '100%',
        renderHTML: (attrs) => (attrs.width ? { style: `width:${attrs.width}` } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (el) => (el as HTMLElement).dataset.align || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
      caption: {
        default: '',
        parseHTML: (el) => {
          const cap = (el as HTMLElement).querySelector?.('figcaption')
          return cap?.textContent || (el as HTMLElement).getAttribute('data-caption') || ''
        },
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'figure[data-type="image"]' },
      { tag: 'img[src]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, align, width, src, alt, title, ...rest } = HTMLAttributes as Record<string, unknown>
    return [
      'figure',
      { 'data-type': 'image', 'data-align': align, class: 'te-figure', style: `text-align:${align}` },
      ['img', { ...rest, src, alt, title, class: 'te-img', style: `width:${width}` }],
      ...(caption ? [['figcaption', { class: 'te-caption' }, caption]] : []),
    ] as unknown as [string, Record<string, unknown>, ...unknown[]]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

function ResizableImageView(props: NodeViewProps) {
  const { node, updateAttributes, selected, editor } = props
  const { src, alt, width, align, caption } = node.attrs as {
    src: string; alt?: string; width: string; align: 'left' | 'center' | 'right'; caption: string
  }
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localCaption, setLocalCaption] = useState(caption)

  useEffect(() => setLocalCaption(caption), [caption])

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const parent = wrapRef.current?.parentElement
    const containerW = parent?.getBoundingClientRect().width ?? 640
    const startW = wrapRef.current?.getBoundingClientRect().width ?? containerW
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX
      const next = Math.min(Math.max(startW + delta, 120), containerW)
      const pct = Math.round((next / containerW) * 100)
      updateAttributes({ width: `${Math.max(20, Math.min(100, pct))}%` })
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [updateAttributes])

  const setAlign = (a: 'left' | 'center' | 'right') => updateAttributes({ align: a })
  const setPreset = (w: string) => updateAttributes({ width: w })

  const isEditable = editor.isEditable

  return (
    <NodeViewWrapper
      as="figure"
      data-type="image"
      data-align={align}
      className="te-figure not-prose relative"
      style={{ textAlign: align }}
    >
      <div
        ref={wrapRef}
        className={`te-img-wrap relative inline-block align-top ${selected ? 'ring-2 ring-primary rounded-lg' : ''}`}
        style={{ width, maxWidth: '100%' }}
      >
        <img
          src={src}
          alt={alt || ''}
          draggable={false}
          className="te-img block w-full h-auto rounded-lg select-none"
        />

        {isEditable && (
          <>
            {/* Toolbar overlay */}
            <div
              className={`absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-md bg-foreground text-background px-1 py-0.5 shadow-md text-xs transition ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              contentEditable={false}
            >
              <IBtn on={align === 'left'} onClick={() => setAlign('left')}>Left</IBtn>
              <IBtn on={align === 'center'} onClick={() => setAlign('center')}>Center</IBtn>
              <IBtn on={align === 'right'} onClick={() => setAlign('right')}>Right</IBtn>
              <span className="mx-1 h-3 w-px bg-background/40" />
              <IBtn on={width === '40%'} onClick={() => setPreset('40%')}>S</IBtn>
              <IBtn on={width === '70%'} onClick={() => setPreset('70%')}>M</IBtn>
              <IBtn on={width === '100%'} onClick={() => setPreset('100%')}>L</IBtn>
            </div>

            {/* Resize handle */}
            <span
              onPointerDown={onResizeStart}
              contentEditable={false}
              aria-label="Resize image"
              className={`absolute bottom-2 right-2 h-4 w-4 cursor-ew-resize rounded-sm bg-primary/90 border-2 border-background shadow ${dragging ? 'scale-110' : ''}`}
            />
          </>
        )}
      </div>

      {isEditable ? (
        <input
          value={localCaption}
          onChange={(e) => setLocalCaption(e.target.value)}
          onBlur={() => updateAttributes({ caption: localCaption })}
          placeholder="Write a caption (optional)…"
          className="te-caption-input mt-2 w-full bg-transparent border-0 outline-none text-center text-sm italic text-muted-foreground placeholder:text-muted-foreground/60"
          contentEditable={false}
        />
      ) : (
        caption ? <figcaption className="te-caption mt-2 text-center text-sm italic text-muted-foreground">{caption}</figcaption> : null
      )}
    </NodeViewWrapper>
  )
}

function IBtn({ children, on, onClick }: { children: React.ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-1.5 py-0.5 rounded ${on ? 'bg-primary text-primary-foreground' : 'hover:bg-background/15'}`}
    >{children}</button>
  )
}
