// Finding the real article behind a feed link, and the article's own picture.
// Pure helpers (no network), unit-tested in src/test/newsdeskPhoto.test.ts.
//
// Most Abia headlines come from Google News searches, whose links are Google
// pages rather than the newspaper's. The bot asks Google for the newspaper's
// address so it can read the full report and use the report's own picture on
// the post's banner (credited to the newspaper).

/** The article code in a Google News link, or null for any other link. */
export function googleNewsId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'news.google.com') return null
    const m = u.pathname.match(/\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]{20,})$/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/** The two values on Google's article page that its address lookup asks for. */
export function googleSignature(html: string): { signature: string; timestamp: number } | null {
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
  const timestamp = Number(html.match(/data-n-a-ts="(\d+)"/)?.[1])
  return signature && Number.isFinite(timestamp) && timestamp > 0 ? { signature, timestamp } : null
}

/** The form body of Google's address lookup for one article. */
export function googleLookupBody(id: string, signature: string, timestamp: number): string {
  const inner = JSON.stringify([
    'garturlreq',
    [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id,
    timestamp,
    signature,
  ])
  return `f.req=${encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]))}`
}

/** The newspaper's address in Google's answer, or null. */
export function googleLookupResult(text: string): string | null {
  const at = text.indexOf('garturlres')
  const start = at < 0 ? -1 : text.indexOf('http', at)
  if (start < 0 || start - at > 30) return null
  const m = text.slice(start, start + 2000).match(/^https?:\/\/[^\s"\\]+/)
  if (!m) return null
  try {
    return new URL(m[0]).toString()
  } catch {
    return null
  }
}

const NOT_A_PHOTO = /logo|favicon|placeholder|default[-_.]|avatar|sprite|blank\.|\.svg(\?|$)|\.gif(\?|$)/i

/**
 * The picture a news page offers for link previews (og:image), which is the
 * report's own photo. Site logos and placeholders are left out.
 */
export function articlePhoto(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 200_000)
  for (const name of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    const key = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tag = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key}["'][^>]*>`, 'i').exec(head)?.[0]
    const raw = tag?.match(/\bcontent=["']([^"']+)["']/i)?.[1]
    if (!raw) continue
    try {
      const u = new URL(raw.replace(/&amp;/g, '&').trim(), pageUrl)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue
      if (NOT_A_PHOTO.test(u.pathname)) continue
      return u.toString()
    } catch {
      // not an address: try the next tag
    }
  }
  return null
}

/** The credit printed on the banner beside the picture. */
export function photoCredit(publisher: string): string {
  const name = publisher.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N} .,&'’()-]/gu, '').trim().slice(0, 40)
  return name ? `Photo: ${name}` : 'Photo: the publisher'
}
