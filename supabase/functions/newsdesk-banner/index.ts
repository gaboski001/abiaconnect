// Draws one Newsdesk post's banner and saves it.
//
// Called only by the daily-newsdesk function (service key) with { post_id }.
// Drawing is kept in its own function so each picture gets its own share of
// the server's processing time, however many posts a run writes.
//
// The picture is the post's headline beside a news report's own photo
// ({ photos: [{ url, credit }] }, on https://abiaconnect.com/og/plain-<forum>.jpg)
// or, without one, on the forum's stock card (og/base-<forum>.jpg). It is stored in the public
// "newsdesk" storage bucket and its address saved on the post (banner_url).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireScheduler } from '../_shared/cron-auth.ts'
import { renderBanner, type BannerFonts } from '../_shared/newsdesk-banner.ts'
import { FORUM_CARDS } from '../_shared/newsdesk-core.ts'

const SITE_URL = 'https://abiaconnect.com'
const BUCKET = 'newsdesk'
const MAX_PHOTO_BYTES = 1_500_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * A report's picture: a JPEG or PNG from an ordinary public web address, not
 * too large to draw within the function's processing time.
 */
async function downloadPhoto(url: string): Promise<Uint8Array> {
  const u = new URL(url)
  const host = u.hostname.toLowerCase()
  const ordinary = (u.protocol === 'https:' || u.protocol === 'http:') && host.includes('.') && !/^[\d.]+$/.test(host) && !host.includes(':')
  if (!ordinary || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('not a public address')
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AbiaConnectNewsdesk/1.0; +https://abiaconnect.com)', Accept: 'image/jpeg, image/png;q=0.9' },
  })
  if (!res.ok) throw new Error(`photo answered ${res.status}`)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_PHOTO_BYTES) throw new Error('photo too large')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('photo too large')
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (!jpeg && !png) throw new Error('photo is not a JPEG or PNG')
  return bytes
}

// Fonts are the same for every picture: fetched once while the function stays warm.
let fonts: Promise<BannerFonts> | null = null
function loadFonts(): Promise<BannerFonts> {
  fonts ??= Promise.all([
    download(`${SITE_URL}/fonts/NotoSans-Bold.ttf`),
    download(`${SITE_URL}/fonts/NotoSans-Regular.ttf`),
  ]).then(([bold, regular]) => ({ bold, regular }))
  fonts.catch(() => {
    fonts = null // try again next time
  })
  return fonts
}

Deno.serve(async (req) => {
  const denied = await requireScheduler(req)
  if (denied) return denied

  try {
    const { post_id, photos } = (await req.json().catch(() => ({}))) as { post_id?: string; photos?: unknown }
    if (!post_id || !UUID_RE.test(post_id)) return json({ error: 'post_id required' }, 400)

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const { data: post } = await db
      .from('newsdesk_posts')
      .select('id, title, banner_title, category_slug')
      .eq('id', post_id)
      .maybeSingle()
    if (!post) return json({ error: 'post not found' }, 404)
    // A forum added later has no blank card yet: the post goes out without a banner.
    if (!FORUM_CARDS.includes(post.category_slug)) return json({ skipped: 'this forum has no banner card' })

    const headline = post.banner_title || post.title
    const loaded = await loadFonts()
    let jpeg: Uint8Array | null = null
    // The reports' own pictures, best first. The first one that can be used is
    // drawn; if none can, the stock card is drawn below.
    const offered = (Array.isArray(photos) ? photos : []).slice(0, 3) as Array<{ url?: unknown; credit?: unknown }>
    for (const photo of offered) {
      if (jpeg || typeof photo?.url !== 'string' || !photo.url) continue
      try {
        const [plain, bytes] = await Promise.all([download(`${SITE_URL}/og/plain-${post.category_slug}.jpg`), downloadPhoto(photo.url)])
        const credit = typeof photo.credit === 'string' && photo.credit ? photo.credit.slice(0, 60) : 'Photo: the publisher'
        jpeg = await renderBanner(plain, loaded, headline, { bytes, credit })
      } catch (e) {
        console.error('newsdesk-banner photo not used', e instanceof Error ? e.message : String(e))
      }
    }
    jpeg ??= await renderBanner(await download(`${SITE_URL}/og/base-${post.category_slug}.jpg`), loaded, headline)

    const path = `banners/${post.id}.jpg`
    let upload = await db.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true })
    if (upload.error) {
      // First picture ever: the bucket does not exist yet.
      await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 1024 * 1024, allowedMimeTypes: ['image/jpeg'] })
      upload = await db.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true })
    }
    if (upload.error) throw new Error(`upload failed: ${upload.error.message}`)

    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    await db.from('newsdesk_posts').update({ banner_url: url }).eq('id', post.id)
    return json({ ok: true, url })
  } catch (e) {
    console.error('newsdesk-banner error', e instanceof Error ? e.message : String(e))
    return json({ error: 'The banner could not be made' }, 500)
  }
})
