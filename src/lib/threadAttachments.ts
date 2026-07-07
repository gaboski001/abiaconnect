import { supabase } from '@/lib/supabase'

export const THREAD_BUCKET = 'thread-attachments'

/**
 * Extract object paths inside the thread-attachments bucket from an HTML string
 * (used for content bodies of threads and replies). Handles both signed and
 * public storage URLs.
 */
export function extractAttachmentPaths(html: string | null | undefined): string[] {
  if (!html) return []
  const paths = new Set<string>()
  const re = new RegExp(
    `/storage/v1/object/(?:sign|public)/${THREAD_BUCKET}/([^"'?\\s>]+)`,
    'g',
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      paths.add(decodeURIComponent(m[1]))
    } catch {
      paths.add(m[1])
    }
  }
  return [...paths]
}

/** Best-effort delete. Never throws — storage RLS filters unauthorized paths. */
export async function deleteAttachmentPaths(paths: string[]): Promise<void> {
  if (!paths.length) return
  try {
    await supabase.storage.from(THREAD_BUCKET).remove(paths)
  } catch {
    // swallow — deletion is best-effort; RLS or missing files should not surface
  }
}

/** Delete paths that were in `prevHtml` but are no longer referenced in `nextHtml`. */
export async function purgeRemovedAttachments(
  prevHtml: string,
  nextHtml: string,
): Promise<void> {
  const prev = new Set(extractAttachmentPaths(prevHtml))
  const next = new Set(extractAttachmentPaths(nextHtml))
  const removed = [...prev].filter((p) => !next.has(p))
  if (removed.length) await deleteAttachmentPaths(removed)
}
