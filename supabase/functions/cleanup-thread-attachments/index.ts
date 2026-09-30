// Periodic cleanup: deletes objects in `thread-attachments` that are no longer
// referenced by any thread.content or reply.content. Only deletes objects
// older than GRACE_HOURS to avoid racing in-progress composer uploads.
//
// Auth: requires the caller to present the service role key as Authorization
// bearer (the pg_cron job does this via the vault secret). Not user-callable.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'thread-attachments'
const GRACE_HOURS = 24
const LIST_PAGE = 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

// Signed URLs look like:
//   {SUPABASE_URL}/storage/v1/object/sign/thread-attachments/{user_id}/{file}?token=...
// Public/rendered paths may also appear as bare `{user_id}/{file}`.
// Extract the `{user_id}/{file}` portion.
const PATH_RE = /thread-attachments\/([A-Za-z0-9_-]+\/[A-Za-z0-9._-]+)/g

function extractPaths(text: string | null): string[] {
  if (!text) return []
  const out: string[] = []
  let m: RegExpExecArray | null
  PATH_RE.lastIndex = 0
  while ((m = PATH_RE.exec(text))) out.push(m[1])
  return out
}

async function collectReferencedPaths(): Promise<Set<string>> {
  const referenced = new Set<string>()
  const like = `%thread-attachments/%`

  for (const table of ['threads', 'replies'] as const) {
    let from = 0
    const step = 1000
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select('content')
        .ilike('content', like)
        .range(from, from + step - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      for (const row of data) {
        for (const p of extractPaths((row as { content: string | null }).content)) {
          referenced.add(p)
        }
      }
      if (data.length < step) break
      from += step
    }
  }
  return referenced
}

async function listAllObjects(): Promise<{ path: string; created_at: string }[]> {
  const results: { path: string; created_at: string }[] = []

  // Top level: each entry with no metadata is a folder (user_id).
  const topFolders: string[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: LIST_PAGE, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      // folders have no id/metadata
      if (!item.id) topFolders.push(item.name)
    }
    if (data.length < LIST_PAGE) break
    offset += LIST_PAGE
  }

  for (const folder of topFolders) {
    let foff = 0
    for (;;) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: LIST_PAGE, offset: foff })
      if (error) throw error
      if (!data || data.length === 0) break
      for (const item of data) {
        if (!item.id) continue // nested folder (unexpected but skip)
        results.push({
          path: `${folder}/${item.name}`,
          created_at: item.created_at ?? new Date().toISOString(),
        })
      }
      if (data.length < LIST_PAGE) break
      foff += LIST_PAGE
    }
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Auth: require service role bearer.
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  const startedAt = Date.now()
  try {
    const dryRun = new URL(req.url).searchParams.get('dry') === '1'
    const cutoff = Date.now() - GRACE_HOURS * 3600 * 1000

    const [referenced, objects] = await Promise.all([
      collectReferencedPaths(),
      listAllObjects(),
    ])

    const orphans: string[] = []
    for (const o of objects) {
      const age = new Date(o.created_at).getTime()
      if (age > cutoff) continue // still inside grace period
      if (referenced.has(o.path)) continue
      orphans.push(o.path)
    }

    let deleted = 0
    if (!dryRun && orphans.length) {
      // storage.remove has a payload cap; chunk to be safe.
      const chunkSize = 100
      for (let i = 0; i < orphans.length; i += chunkSize) {
        const chunk = orphans.slice(i, i + chunkSize)
        const { error } = await supabase.storage.from(BUCKET).remove(chunk)
        if (error) throw error
        deleted += chunk.length
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        scanned: objects.length,
        referenced: referenced.size,
        orphans: orphans.length,
        deleted,
        graceHours: GRACE_HOURS,
        durationMs: Date.now() - startedAt,
        sample: orphans.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    )
  }
})
