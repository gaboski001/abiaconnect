import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractStoragePath(pathOrUrl: string, bucket: string): string | null {
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) return null

  let value = pathOrUrl.trim()
  if (/^https?:\/\//.test(value)) {
    try {
      const url = new URL(value)
      value = decodeURIComponent(url.pathname)
    } catch {
      return null
    }
  }

  const marker = `/storage/v1/object/`
  const markerIndex = value.indexOf(marker)
  if (markerIndex >= 0) {
    const objectPath = value.slice(markerIndex + marker.length)
    const match = objectPath.match(new RegExp(`^(?:public|sign|authenticated)/${escapeRegExp(bucket)}/(.+)$`))
    return match?.[1] ?? null
  }

  return value
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${escapeRegExp(bucket)}/`), '')
}

/**
 * Returns a usable image URL for a stored path. If the value is already a full URL,
 * it's returned as-is. Otherwise a signed URL is requested from the given private bucket.
 */
export function useSignedUrl(
  pathOrUrl: string | null | undefined,
  bucket: 'avatars' | 'site-assets' | string = 'avatars',
  expiresIn = 60 * 60,
): string | null {
  // Only short-circuit for external (non-Supabase-storage) URLs. Public-looking
  // storage URLs (`/storage/v1/object/public/...`) still 403 when the bucket is
  // private, so we always re-sign anything that points at Supabase storage.
  const isExternalUrl = (v: string) =>
    /^https?:\/\//.test(v) && !v.includes('/storage/v1/object/')

  const [url, setUrl] = useState<string | null>(() => {
    if (!pathOrUrl) return null
    if (isExternalUrl(pathOrUrl)) return pathOrUrl
    return null
  })

  useEffect(() => {
    let cancelled = false
    if (!pathOrUrl) {
      setUrl(null)
      return
    }
    if (isExternalUrl(pathOrUrl)) {
      setUrl(pathOrUrl)
      return
    }
    const cleanPath = extractStoragePath(pathOrUrl, bucket)
    if (!cleanPath) {
      setUrl(pathOrUrl)
      return
    }
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
