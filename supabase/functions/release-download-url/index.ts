// Issues a short-lived signed download URL for the ACTIVE app release file.
// Direct storage reads on app-releases are admin-only; signed-in users get
// access only through this function, which verifies the file belongs to an
// active release.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const Body = z.object({ filePath: z.string().min(1).max(512) })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  })
  const { data: claims, error: claimErr } = await userClient.auth.getClaims(
    auth.replace('Bearer ', ''),
  )
  if (claimErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401)

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: 'Invalid request' }, 400)
  const { filePath } = parsed.data

  const admin = createClient(SUPABASE_URL, SERVICE)
  const { data: rel, error: relErr } = await admin
    .from('app_releases')
    .select('id')
    .eq('file_path', filePath)
    .eq('is_active', true)
    .maybeSingle()
  if (relErr) {
    console.error('release lookup failed', relErr)
    return json({ error: 'Could not generate download link' }, 500)
  }
  if (!rel) return json({ error: 'Release not found' }, 404)

  const { data, error } = await admin.storage
    .from('app-releases')
    .createSignedUrl(filePath, 60 * 10, { download: true })
  if (error || !data?.signedUrl) {
    console.error('sign failed', error)
    return json({ error: 'Could not generate download link' }, 500)
  }
  return json({ signedUrl: data.signedUrl })
})
