// Writes a share page for every Newsdesk bot post that has its own banner:
// public/share/post-<thread id>.html, plus its line in public/share/index.json
// (thread id -> page), so links to the post preview its banner on Facebook and
// WhatsApp. Run by .github/workflows/newsdesk-share-pages.yml, which commits
// whatever this adds. Hand-made share pages already in the list are left alone.
// Run by hand: node scripts/newsdesk/sync_share_pages.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SITE = 'https://abiaconnect.com'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The post's opening words, for the preview's description. */
export function summary(html, limit = 200) {
  const text = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length <= limit ? text : `${text.slice(0, limit - 1).replace(/\s+\S*$/, '')}…`
}

/** The same page the hand-made share pages use (scripts/newsdesk/make_share_pages.py). */
export function sharePage(post) {
  const thread = `${SITE}/thread/${post.thread_id}`
  const title = escapeHtml(post.title)
  const desc = escapeHtml(summary(post.content))
  const image = escapeHtml(post.banner_url)
  const alt = escapeHtml(post.banner_title || post.title)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${thread}">
<meta property="og:site_name" content="AbiaConnect">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/share/post-${post.thread_id}.html">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${image}">
<meta name="robots" content="noindex, follow">
<style>body{margin:0;font-family:system-ui,sans-serif;background:#022c22;color:#ecfdf5;display:grid;place-items:center;min-height:100vh;text-align:center;padding:16px}a{color:#f0d278}img{max-width:100%;height:auto;border-radius:12px}</style>
<script>location.replace(${JSON.stringify(thread)});</script>
</head>
<body>
<main>
<img src="${image}" width="600" height="315" alt="${alt}">
<p><a href="${thread}">Open the discussion on AbiaConnect</a></p>
</main>
</body>
</html>
`
}

/**
 * Which pages to write. Only posts with a real thread id and a banner kept in
 * this project's own storage; threads that already have a share page are skipped.
 * Returns { pages: { fileName: html }, index: the updated list }.
 */
export function planPages(feed, index, storageBase) {
  const next = { ...index }
  const pages = {}
  for (const post of Array.isArray(feed) ? feed : []) {
    const id = String(post?.thread_id ?? '').toLowerCase()
    if (!UUID_RE.test(id) || next[id]) continue
    const banner = String(post?.banner_url ?? '')
    if (!banner.startsWith(storageBase) || !banner.endsWith('.jpg') || /["<>\s]/.test(banner)) continue
    if (!post.title) continue
    pages[`post-${id}.html`] = sharePage({ ...post, thread_id: id })
    next[id] = `/share/post-${id}.html`
  }
  return { pages, index: next }
}

/** VITE_SUPABASE_URL and the public app key, from the environment or the repo's .env. */
function settings(root) {
  const env = { ...process.env }
  const file = join(root, '.env')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2]
    }
  }
  return { url: (env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''), key: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '' }
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const out = join(root, 'public', 'share')
  const indexPath = join(out, 'index.json')
  const { url, key } = settings(root)
  if (!url || !key) {
    console.log('No Supabase address or key found; nothing to do.')
    return
  }

  // A failed read is not an error worth an alert: the next run tries again.
  let feed
  try {
    const res = await fetch(`${url}/rest/v1/rpc/newsdesk_share_feed`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.log(`The list of posts could not be read (HTTP ${res.status}); trying again next time.`)
      return
    }
    feed = await res.json()
  } catch (e) {
    console.log(`The list of posts could not be read (${e.message}); trying again next time.`)
    return
  }

  const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {}
  const plan = planPages(feed, index, `${url}/storage/v1/object/public/newsdesk/banners/`)
  const names = Object.keys(plan.pages)
  if (!names.length) {
    console.log(`${feed.length} bot posts with a banner; every one already has its share page.`)
    return
  }
  mkdirSync(out, { recursive: true })
  for (const name of names) writeFileSync(join(out, name), plan.pages[name])
  writeFileSync(indexPath, `${JSON.stringify(plan.index, null, 2)}\n`)
  console.log(`Wrote ${names.length} share page${names.length === 1 ? '' : 's'}:\n${names.map((n) => `  ${SITE}/share/${n}`).join('\n')}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
