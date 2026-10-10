// Draws one Newsdesk post's banner and saves it.
//
// Called only by the daily-newsdesk function (service key) with { post_id }.
// Drawing is kept in its own function so each picture gets its own share of
// the server's processing time, however many posts a run writes.
//
// The picture is the post's headline on its forum's blank card
// (https://abiaconnect.com/og/base-<forum>.jpg). It is stored in the public
// "newsdesk" storage bucket and its address saved on the post (banner_url).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireScheduler } from '../_shared/cron-auth.ts'
import { renderBanner, type BannerFonts } from '../_shared/newsdesk-banner.ts'
import { FORUM_CARDS } from '../_shared/newsdesk-core.ts'

const SITE_URL = 'https://abiaconnect.com'
const BUCKET = 'newsdesk'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
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
    const { post_id } = (await req.json().catch(() => ({}))) as { post_id?: string }
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

    const [base, loaded] = await Promise.all([download(`${SITE_URL}/og/base-${post.category_slug}.jpg`), loadFonts()])
    const jpeg = await renderBanner(base, loaded, post.banner_title || post.title)

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
