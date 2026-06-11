import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Returns a usable image URL for a stored path. If the value is already a full URL,
 * it's returned as-is. Otherwise a signed URL is requested from the given private bucket.
 */
export function useSignedUrl(
  pathOrUrl: string | null | undefined,
  bucket: 'avatars' | 'site-assets' | string = 'avatars',
  expiresIn = 60 * 60,
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!pathOrUrl) return null
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl
    return null
  })

  useEffect(() => {
    let cancelled = false
    if (!pathOrUrl) {
      setUrl(null)
      return
    }
    if (/^https?:\/\//.test(pathOrUrl)) {
      setUrl(pathOrUrl)
      return
    }
    const cleanPath = pathOrUrl
      .replace(/^\//, '')
      .replace(new RegExp(`^${bucket}/`), '')
    supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, expiresIn)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [pathOrUrl, bucket, expiresIn])

  return url
}
