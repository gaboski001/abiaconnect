/**
 * Verify backfill: scan storage buckets and DB columns that hold image URLs,
 * then confirm every file is WebP and every referenced URL resolves.
 *
 * Run with:  bun run scripts/verify-webp.ts
 * Requires:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const BUCKETS = ['avatars', 'site-assets']
const ALLOWED_EXT = new Set(['webp', 'svg']) // svg is intentionally skipped by the converter

type Issue = { kind: string; detail: string }
const issues: Issue[] = []

async function walk(bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    if (!data?.length) break
    for (const e of data) {
      const p = prefix ? `${prefix}/${e.name}` : e.name
      if (e.id === null) out.push(...(await walk(bucket, p)))
      else out.push(p)
    }
    if (data.length < limit) break
    offset += limit
  }
  return out
}

async function checkUrl(url: string): Promise<number | string> {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    return r.status
  } catch (e: any) {
    return e.message
  }
}

async function verifyDbColumn(
  table: string,
  idCol: string,
  urlCol: string,
  bucketHints: string[],
) {
  const { data, error } = await supabase.from(table).select(`${idCol}, ${urlCol}`)
  if (error) {
    issues.push({ kind: 'db-read', detail: `${table}.${urlCol}: ${error.message}` })
    return
  }
  for (const row of data ?? []) {
    const id = (row as any)[idCol]
    const url = (row as any)[urlCol] as string | null
    if (!url) continue

    // Extension check
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(ext)) {
      issues.push({ kind: 'non-webp', detail: `${table}#${id} ${urlCol}=${url}` })
    }

    // Reachability — sign if it points at a known private bucket, else HEAD directly.
    let target = url
    const bucket = bucketHints.find((b) => url.includes(`/${b}/`))
    if (bucket) {
      const m = url.match(new RegExp(`/${bucket}/(.+?)(?:\\?|$)`))
      if (m) {
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(m[1], 60)
        if (signed?.signedUrl) target = signed.signedUrl
      }
    }
    const status = await checkUrl(target)
    if (status !== 200) {
      issues.push({ kind: 'broken-url', detail: `${table}#${id} ${urlCol} → ${status} (${url})` })
    }
  }
}

async function run() {
  console.log('— Storage buckets —')
  for (const bucket of BUCKETS) {
    const paths = await walk(bucket)
    console.log(`  ${bucket}: ${paths.length} files`)
    for (const p of paths) {
      const ext = p.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.has(ext)) {
        issues.push({ kind: 'storage-non-webp', detail: `${bucket}/${p}` })
      }
    }
  }

  console.log('\n— DB references —')
  await verifyDbColumn('profiles', 'id', 'avatar_url', ['avatars'])
  await verifyDbColumn('site_settings', 'key', 'value', ['site-assets'])

  console.log(`\n${issues.length} issue(s):`)
  for (const i of issues) console.log(`  [${i.kind}] ${i.detail}`)
  process.exit(issues.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
