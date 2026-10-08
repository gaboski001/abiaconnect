/**
 * Share pages: /share/<name>.html carries a thread's thumbnail for Facebook and
 * WhatsApp link previews, then sends readers on to the thread. The website's
 * /share/index.json lists which threads have one (thread id -> page path).
 * Threads without one share their normal link.
 */
const SITE_URL = 'https://abiaconnect.com'
const SHARE_PATH_RE = /^\/share\/[a-z0-9-]+\.html$/

let index: Promise<Record<string, unknown>> | null = null

function loadIndex(): Promise<Record<string, unknown>> {
  index ??= fetch('/share/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((data) => {
      // Try again next time if it couldn't be read.
      if (!data || typeof data !== 'object' || !Object.keys(data).length) index = null
      return (data ?? {}) as Record<string, unknown>
    })
  return index
}

/** The link to share for a thread: its share page if it has one, otherwise the thread link. */
export async function threadShareLink(threadId: string): Promise<string> {
  const path = (await loadIndex())[threadId]
  return typeof path === 'string' && SHARE_PATH_RE.test(path) ? `${SITE_URL}${path}` : `${SITE_URL}/thread/${threadId}`
}

/** For tests. */
export function resetShareLinkCache() {
  index = null
}
