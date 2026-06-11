/**
 * One-off backfill: convert every existing image in the `avatars` and
 * `site-assets` storage buckets to WebP, re-upload, update DB references,
 * and delete the originals.
 *
 * Run with:  bun run scripts/backfill-webp.ts
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const SKIP_EXT = new Set(['webp', 'svg', 'gif'])

async function walk(bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Folders have a null id in supabase-storage list output.
      if (entry.id === null) {
        const nested = await walk(bucket, path)
        out.push(...nested)
      } else {
        out.push(path)
      }
    }
    if (data.length < limit) break
    offset += limit
  }
  return out
}

async function convertOne(bucket: string, path: string) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  if (SKIP_EXT.has(ext)) return { path, skipped: 'already-optimal' as const }

  const { data: blob, error: dErr } = await supabase.storage.from(bucket).download(path)
  if (dErr || !blob) return { path, error: dErr?.message ?? 'download failed' }

  const buf = Buffer.from(await blob.arrayBuffer())
  let webp: Buffer
  try {
    webp = await sharp(buf, { failOn: 'none' }).webp({ quality: 85 }).toBuffer()
  } catch (e: any) {
    return { path, error: `convert: ${e.message}` }
  }

  const newPath = path.replace(/\.[^./]+$/, '') + '.webp'
  const { error: uErr } = await supabase.storage
    .from(bucket)
    .upload(newPath, webp, { contentType: 'image/webp', upsert: true })
  if (uErr) return { path, error: `upload: ${uErr.message}` }

  // Update DB references that contain the old path string.
  const oldUrlFragment = `${bucket}/${path}`
  const newUrlFragment = `${bucket}/${newPath}`

  if (bucket === 'avatars') {
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .like('avatar_url', `%${oldUrlFragment}%`)
    for (const r of rows ?? []) {
      const updated = (r.avatar_url as string).replace(oldUrlFragment, newUrlFragment)
      await supabase.from('profiles').update({ avatar_url: updated }).eq('id', r.id)
    }
  } else if (bucket === 'site-assets') {
    const { data: rows } = await supabase
      .from('site_settings')
      .select('key, value')
      .like('value', `%${oldUrlFragment}%`)
    for (const r of rows ?? []) {
      const updated = (r.value as string).replace(oldUrlFragment, newUrlFragment)
      await supabase.from('site_settings').update({ value: updated }).eq('key', r.key)
    }
  }

  // Delete the original (only if path actually changed, i.e. extension differed).
  if (newPath !== path) {
    await supabase.storage.from(bucket).remove([path])
  }
  return { path, newPath, bytes: webp.length }
}

async function run() {
  const buckets = ['avatars', 'site-assets']
  for (const bucket of buckets) {
    console.log(`\n=== ${bucket} ===`)
    let paths: string[] = []
    try {
      paths = await walk(bucket)
    } catch (e: any) {
      console.error(`  list failed: ${e.message}`)
      continue
    }
    console.log(`  ${paths.length} files`)
    for (const p of paths) {
      const r = await convertOne(bucket, p)
      console.log('  ', r)
    }
  }
  console.log('\nDone.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
