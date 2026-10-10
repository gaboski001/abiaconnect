import { supabase } from '@/lib/supabase'

/**
 * Share pages: /share/<name>.html carries a thread's thumbnail for Facebook and
 * WhatsApp link previews, then sends readers on to the thread. The website's
 * /share/index.json lists which threads have one (thread id -> page path).
 * Newsdesk bot threads use their forum's page (/share/forum-<forum>.html?t=<id>),
 * which the database knows. Threads without one share their normal link.
 */
const SITE_URL = 'https://abiaconnect.com'
const SHARE_PATH_RE = /^\/share\/[a-z0-9-]+\.html$/
const FORUM_SHARE_PATH_RE = /^\/share\/forum-[a-z0-9-]+\.html\?t=[0-9a-f-]{36}$/

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

/** The forum share page of a Newsdesk bot thread, if it is one. */
async function forumSharePath(threadId: string): Promise<string | null> {
  try {
    const { data } = await supabase.rpc('thread_share_path', { _thread_id: threadId })
    return typeof data === 'string' && FORUM_SHARE_PATH_RE.test(data) && data.endsWith(`?t=${threadId}`) ? data : null
  } catch {
    return null
  }
}

/** The link to share for a thread: its share page if it has one, otherwise the thread link. */
export async function threadShareLink(threadId: string): Promise<string> {
  const path = (await loadIndex())[threadId]
  if (typeof path === 'string' && SHARE_PATH_RE.test(path)) return `${SITE_URL}${path}`
  const forumPath = await forumSharePath(threadId)
  return forumPath ? `${SITE_URL}${forumPath}` : `${SITE_URL}/thread/${threadId}`
}

/** For tests. */
export function resetShareLinkCache() {
  index = null
}
