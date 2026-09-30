import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSiteSettings } from '@/hooks/useSiteSettings'

const CACHE_KEY = 'abia:site-logo'
const SIGN_SECONDS = 60 * 60 * 24 // 24h

interface CachedLogo {
  path: string
  url: string
  expiresAt: number
}

function readCache(): CachedLogo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CachedLogo
    // Keep a margin so we never hand out a link that expires mid-session.
    return c.url && c.expiresAt - 5 * 60 * 1000 > Date.now() ? c : null
  } catch {
    return null
  }
}

function writeCache(c: CachedLogo | null) {
  try {
    if (c) localStorage.setItem(CACHE_KEY, JSON.stringify(c))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* storage unavailable (private mode) — logo still works, just not cached */
  }
}

/** Strip a full storage URL / bucket prefix down to the object path. */
function toObjectPath(value: string): string | null {
  let v = value.trim()
  if (!v || v.startsWith('data:') || v.startsWith('blob:')) return null
  if (/^https?:\/\//.test(v)) {
    if (!v.includes('/storage/v1/object/')) return null // external URL, use as-is
    try {
      v = decodeURIComponent(new URL(v).pathname)
    } catch {
      return null
    }
    const m = v.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/site-assets\/(.+)$/)
    return m?.[1] ?? null
  }
  return v.replace(/^\/+/, '').replace(/^site-assets\//, '')
}

export type SiteLogoStatus = 'loading' | 'ready' | 'none'

/**
 * The site logo URL, shown instantly on repeat visits.
 *
 * The last signed logo URL is cached in localStorage, so the header can
 * render the real logo on the first frame instead of waiting for the
 * settings query and a createSignedUrl round-trip (which used to flash a
 * placeholder icon). When settings load with a different logo (an admin
 * changed it), the new one is signed and replaces the cached one.
 *
 * status: 'loading' while unknown (render an empty slot, not a placeholder),
 * 'ready' when `url` is set, 'none' when no logo is configured.
 */
export function useSiteLogo(): { url: string | null; status: SiteLogoStatus } {
  const { settings, isLoading } = useSiteSettings()
  const configured = (settings.site_logo || settings.logo_url || '').trim()
  const [cached] = useState(readCache)
  const [url, setUrl] = useState<string | null>(cached?.url ?? null)
  const [status, setStatus] = useState<SiteLogoStatus>(cached ? 'ready' : 'loading')

  useEffect(() => {
    if (isLoading) return // keep showing the cached logo until settings arrive

    if (!configured) {
      writeCache(null)
      setUrl(null)
      setStatus('none')
      return
    }

    // External image URL: use directly.
    if (/^https?:\/\//.test(configured) && !configured.includes('/storage/v1/object/')) {
      setUrl(configured)
      setStatus('ready')
      return
    }

    const path = toObjectPath(configured)
    if (!path) {
      setStatus('none')
      return
    }

    const current = readCache()
    if (current && current.path === path) {
      setUrl(current.url)
      setStatus('ready')
      return
    }

    let cancelled = false
    supabase.storage
      .from('site-assets')
      .createSignedUrl(path, SIGN_SECONDS)
      .then(({ data }) => {
        if (cancelled) return
        const signed = data?.signedUrl ?? null
        if (!signed) {
          setStatus(url ? 'ready' : 'none')
          return
        }
        writeCache({ path, url: signed, expiresAt: Date.now() + SIGN_SECONDS * 1000 })
        // Swap only once the new image is downloaded, so there is no blank frame.
        const img = new Image()
        img.onload = img.onerror = () => {
          if (cancelled) return
          setUrl(signed)
          setStatus('ready')
        }
        img.src = signed
      })
      .catch(() => {
        if (!cancelled) setStatus(url ? 'ready' : 'none')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, isLoading])

  return { url, status }
}
