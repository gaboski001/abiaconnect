import DOMPurify from 'dompurify'

/**
 * Sanitize thread/reply HTML for read-only rendering.
 * Keeps the tags & attributes the Tiptap editor emits (figure/figcaption for
 * captioned images, data-align + inline width on the image, safe link rels).
 */
export function sanitizeThreadHtml(html: string | null | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'data-align', 'data-type', 'data-caption'],
    ADD_TAGS: ['figure', 'figcaption'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  })
}
