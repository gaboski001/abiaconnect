// Scans a file in Supabase Storage with VirusTotal.
// Returns { clean: boolean, stats?, analysisId?, error? }.
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
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function poll(analysisId: string) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${VT_API}/analyses/${analysisId}`, {
      headers: { 'x-apikey': VT_KEY },
    })
    if (!res.ok) throw new Error(`VT poll ${res.status}`)
    const j = await res.json()
    const status = j?.data?.attributes?.status
    if (status === 'completed') return j.data.attributes.stats as Record<string, number>
    await sleep(2500)
  }
  throw new Error('VT scan timeout')
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
    if (claimErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401)

    if (!VT_KEY) return json({ error: 'Scanner not configured' }, 500)

    const { bucket, path } = await req.json().catch(() => ({}))
    if (!bucket || !path) return json({ error: 'bucket and path required' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path)
    if (dlErr || !blob) return json({ error: dlErr?.message || 'download failed' }, 400)

    // VT direct upload limit is 32MB; we cap chat at 2MB so this is fine.
    if (blob.size > 32 * 1024 * 1024) {
      return json({ error: 'File too large to scan' }, 413)
    }

    const form = new FormData()
    form.append('file', blob, path.split('/').pop() || 'file')
    const up = await fetch(`${VT_API}/files`, {
      method: 'POST',
      headers: { 'x-apikey': VT_KEY },
      body: form,
    })
    if (!up.ok) {
      const t = await up.text()
      return json({ error: `VT upload failed: ${up.status} ${t.slice(0, 200)}` }, 502)
    }
    const upJson = await up.json()
    const analysisId = upJson?.data?.id
    if (!analysisId) return json({ error: 'VT missing analysis id' }, 502)

    const stats = await poll(analysisId)
    const malicious = (stats.malicious ?? 0) + (stats.suspicious ?? 0)
    const clean = malicious === 0

    return json({ clean, stats, analysisId })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
