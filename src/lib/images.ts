import { supabase } from '@/lib/supabase'

/**
 * Resolve a stored value to a public Supabase Storage URL.
 * Accepts a full URL (returned as-is) or a bare object path.
 */
export function getStorageUrl(
  pathOrUrl: string | null | undefined,
  bucket: 'avatars' | 'site-assets' | string = 'avatars',
): string | null {
  if (!pathOrUrl) return null
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }
  const cleanPath = pathOrUrl
    .replace(/^\//, '')
    .replace(new RegExp(`^${bucket}/`), '')
  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath)
  return data?.publicUrl ?? null
}

/** Inline SVG fallback avatar with the user's initials. */
export function getAvatarFallback(displayName: string | null | undefined): string {
  const name = (displayName || 'User').trim()
  const initials =
    name
      .split(/\s+/)
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%23013220'/><text x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' fill='%23c9a84c' font-size='30' font-family='system-ui,-apple-system,sans-serif' font-weight='600'>${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${svg}`
}

export async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}
