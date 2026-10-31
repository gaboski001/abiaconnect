import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { extractAttachmentPaths, THREAD_BUCKET } from '@/lib/threadAttachments'
import { sanitizeThreadHtml } from '@/lib/sanitizeThreadHtml'

/** Refresh stored attachment URLs under the viewer's current storage permissions. */
export function useThreadHtml(html: string | null | undefined): string {
  const { user } = useAuth()
  const safe = sanitizeThreadHtml(html)
  const paths = extractAttachmentPaths(safe)
  const query = useQuery({
    queryKey: ['thread-image-urls', user?.id, safe],
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
    refetchInterval: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(THREAD_BUCKET).createSignedUrls(paths, 3600)
      if (error) throw error
      const doc = new DOMParser().parseFromString(safe, 'text/html')
      for (const image of doc.querySelectorAll('img')) {
        const path = extractAttachmentPaths(image.outerHTML)[0]
        const signed = data?.find((item) => item.path === path && !item.error)?.signedUrl
        if (signed) image.setAttribute('src', signed)
      }
      return sanitizeThreadHtml(doc.body.innerHTML)
    },
  })
  return query.data ?? safe
}