// Scans a file in Supabase Storage with VirusTotal.
// Returns { clean, stats?, analysisId?, error?, fallback? }.
// If VT is rate-limited / temporarily unavailable after retries we return
// { clean: true, fallback: true } so uploads aren't blocked by a flaky scanner.
// On malicious/suspicious verdict the caller should delete the object.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VT_API = 'https://www.virustotal.com/api/v3'
const VT_KEY = Deno.env.get('VIRUSTOTAL_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Only buckets the app actually scans after upload.
const SCANNABLE_BUCKETS = new Set(['avatars', 'site-assets', 'chat-attachments', 'thread-attachments'])
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class TransientVTError extends Error {
  constructor(public status: number, public retryAfterMs?: number) {
    super(`VT transient ${status}`)
  }
}

async function vtFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init)
    if (res.ok) return res
    const transient = res.status === 429 || res.status >= 500
    if (!transient || attempt === MAX_RETRIES) {
      if (transient) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10)
        throw new TransientVTError(res.status, retryAfter * 1000 || undefined)
      }
      const t = await res.text().catch(() => '')
      throw new Error(`VT ${res.status} ${t.slice(0, 200)}`)
    }
    const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10)
    const backoff =
      retryAfter * 1000 || INITIAL_BACKOFF_MS * 2 ** attempt
    console.warn(`VT ${res.status} — retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
    await sleep(backoff)
  }
  throw new TransientVTError(503)
}

async function poll(analysisId: string) {
  for (let i = 0; i < 20; i++) {
    const res = await vtFetch(`${VT_API}/analyses/${analysisId}`, {
      headers: { 'x-apikey': VT_KEY },
    })
    const j = await res.json()
    const status = j?.data?.attributes?.status
    if (status === 'completed') return j.data.attributes.stats as Record<string, number>
    await sleep(2500)
  }
  throw new TransientVTError(504)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    )
    if (claimErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401)

    if (!VT_KEY) {
      console.error('VIRUSTOTAL_API_KEY missing — entering fallback mode')
      return json({ clean: true, fallback: true, error: 'Scanner not configured' })
    }

    const { bucket, path } = await req.json().catch(() => ({}))
    if (!bucket || !path) return json({ error: 'bucket and path required' }, 400)
    if (!SCANNABLE_BUCKETS.has(bucket)) return json({ error: 'bucket not allowed' }, 400)

    // Download AS THE CALLER so storage RLS decides access. Using the service
    // role here let any signed-in user make us fetch someone else's private
    // file (e.g. another conversation's chat attachment) and upload it to
    // VirusTotal. Uploaders can always read their own freshly uploaded file.
    const { data: blob, error: dlErr } = await userClient.storage.from(bucket).download(path)
    if (dlErr || !blob) return json({ error: 'File not found or access denied' }, 403)

    if (blob.size > 32 * 1024 * 1024) {
      return json({ error: 'File too large to scan' }, 413)
    }

    try {
      const form = new FormData()
      form.append('file', blob, path.split('/').pop() || 'file')
      const up = await vtFetch(`${VT_API}/files`, {
        method: 'POST',
        headers: { 'x-apikey': VT_KEY },
        body: form,
      })
      const upJson = await up.json()
      const analysisId = upJson?.data?.id
      if (!analysisId) throw new TransientVTError(502)

      const stats = await poll(analysisId)
      const malicious = (stats.malicious ?? 0) + (stats.suspicious ?? 0)
      return json({ clean: malicious === 0, stats, analysisId, fallback: false })
    } catch (e) {
      if (e instanceof TransientVTError) {
        console.warn('VT unavailable, returning fallback clean verdict', e.status)
        return json({
          clean: true,
          fallback: true,
          error: `SCANNING_SERVICE_UNAVAILABLE_${e.status}`,
        })
      }
      throw e
    }
  } catch (e) {
    console.error('scan-attachment error', e)
    return json({ clean: true, fallback: true, error: (e as Error).message })
  }
})
