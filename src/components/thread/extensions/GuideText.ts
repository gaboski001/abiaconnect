import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { OPENING_HINT, hintForHeading } from '@/lib/storyLayouts'

/**
 * Grey guide text on the empty lines of a story. It is drawn by the editor
 * only (as a `data-placeholder` on the empty paragraph) and is never part of
 * the saved post.
 * - Nothing written yet: the editor's own placeholder.
 * - Empty first line of a post that has headings: how to open.
 * - Empty line under a heading from a layout: what that section asks for.
 */
export const GuideText = Extension.create<{ placeholder: string }>({
  name: 'guideText',

  addOptions() {
    return { placeholder: '' }
  },

  addProseMirrorPlugins() {
    const { placeholder } = this.options
    return [
      new Plugin({
        key: new PluginKey('guideText'),
        props: {
          decorations: ({ doc }) => {
            const blank = doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph' && doc.firstChild.content.size === 0
            const decorations: Decoration[] = []
            let previous: typeof doc.firstChild = null
            doc.forEach((node, pos) => {
              if (node.type.name === 'paragraph' && node.content.size === 0) {
                const text = blank
                  ? placeholder
                  : !previous
                    ? OPENING_HINT
                    : previous.type.name === 'heading'
                      ? hintForHeading(previous.textContent)
                      : ''
                if (text) {
                  decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'is-empty', 'data-placeholder': text }))
                }
              }
              previous = node
            })
            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
