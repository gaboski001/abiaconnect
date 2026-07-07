/**
 * Tiny localStorage-backed draft store for the thread composer.
 * Keyed by scope ("new", "subgroup:<id>", "category:<id>") so drafts don't
 * collide when a user is composing in multiple contexts.
 */

const PREFIX = 'abia:thread-draft:'
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

export interface ThreadDraft {
  title: string
  content: string
  tags: string[]
  updatedAt: number
}

const key = (scope: string) => `${PREFIX}${scope}`

export function loadDraft(scope: string): ThreadDraft | null {
  try {
    const raw = localStorage.getItem(key(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ThreadDraft
    if (!parsed || typeof parsed !== 'object') return null
    if (Date.now() - (parsed.updatedAt ?? 0) > MAX_AGE_MS) {
      localStorage.removeItem(key(scope))
      return null
    }
    // A draft is "meaningful" only if it has real title or content beyond an empty <p>.
    const bareContent = (parsed.content ?? '').replace(/<p>\s*<\/p>/g, '').trim()
    if (!parsed.title?.trim() && !bareContent) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDraft(scope: string, draft: Omit<ThreadDraft, 'updatedAt'>) {
  try {
    const bareContent = (draft.content ?? '').replace(/<p>\s*<\/p>/g, '').trim()
    if (!draft.title.trim() && !bareContent && draft.tags.length === 0) {
      clearDraft(scope)
      return
    }
    localStorage.setItem(
      key(scope),
      JSON.stringify({ ...draft, updatedAt: Date.now() } satisfies ThreadDraft),
    )
  } catch {
    /* quota or private-mode — ignore */
  }
}

export function clearDraft(scope: string) {
  try { localStorage.removeItem(key(scope)) } catch { /* noop */ }
}
