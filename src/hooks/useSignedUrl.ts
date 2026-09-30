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

// Buckets served publicly (profile pictures, site images). Files are readable
// by exact URL only; there is no API read access, so createSignedUrl would fail.
const PUBLIC_BUCKETS = new Set(['avatars', 'site-assets'])

function publicUrlFor(pathOrUrl: string, bucket: string): string | null {
  if (!PUBLIC_BUCKETS.has(bucket)) return null
  const cleanPath = extractStoragePath(pathOrUrl, bucket)
  if (!cleanPath) return pathOrUrl
  return supabase.storage.from(bucket).getPublicUrl(cleanPath).data.publicUrl
}

/**
 * Returns a usable image URL for a stored path. If the value is already a full URL,
 * it's returned as-is. Public buckets get their public URL; otherwise a signed URL
 * is requested from the given private bucket.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()


export function useSignedUrl(
  pathOrUrl: string | null | undefined,
  bucket: 'avatars' | 'site-assets' | string = 'avatars',
  expiresIn = 60 * 60,
): string | null {
  const isExternalUrl = (v: string) =>
    /^https?:\/\//.test(v) && !v.includes('/storage/v1/object/')

  const cacheKey = pathOrUrl ? `${bucket}::${pathOrUrl}` : null
  const cached = cacheKey ? signedUrlCache.get(cacheKey) : null
  const cachedValid = cached && cached.expiresAt > Date.now() ? cached.url : null

  const [url, setUrl] = useState<string | null>(() => {
    if (!pathOrUrl) return null
    if (isExternalUrl(pathOrUrl)) return pathOrUrl
    return publicUrlFor(pathOrUrl, bucket) ?? cachedValid
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
    const publicUrl = publicUrlFor(pathOrUrl, bucket)
    if (publicUrl) {
      setUrl(publicUrl)
      return
    }
    const key = `${bucket}::${pathOrUrl}`
    const hit = signedUrlCache.get(key)
    if (hit && hit.expiresAt > Date.now()) {
      setUrl(hit.url)
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
        if (cancelled) return
        const signed = data?.signedUrl ?? null
        if (signed) {
          signedUrlCache.set(key, {
            url: signed,
            expiresAt: Date.now() + (expiresIn - 60) * 1000,
          })
        }
        setUrl(signed)
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
