// Admin-only: asks one AI provider a tiny question, so the site owner can check
// an API key and model work before switching the Newsdesk and Ugo over to it.
// Never uses the Lovable AI backup, so a broken key shows up as broken.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import * as ai from '../_shared/ai.ts'
import { askAiJson, loadAiConfig, modelFor, PROVIDERS, type AiProvider } from '../_shared/ai.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } })
  const { data: claims } = await userClient.auth.getClaims(auth.replace('Bearer ', ''))
  const userId = claims?.claims?.sub
  if (!userId) return json({ error: 'Unauthorized' }, 401)
  const { data: isAdmin } = await userClient.rpc('is_admin', { _user_id: userId })
  if (!isAdmin) return json({ error: 'Forbidden' }, 403)

  const body = (await req.json().catch(() => ({}))) as { provider?: string }
  const config = await loadAiConfig(true)
  const provider = (PROVIDERS.includes(body.provider as AiProvider) ? body.provider : config.provider) as AiProvider
  const started = Date.now()
  const answer = await askAiJson(
    'test',
    {
      system: 'You check that an AI service works for AbiaConnect, a community site for people from Abia State, Nigeria.',
      user: 'Reply with JSON: {"ok": true, "message": "<a warm greeting to AbiaConnect members in under 10 words>"}',
      temperature: 0,
    },
    { provider, noFallback: true, timeoutMs: 25_000 },
  )
  let message: string | null = null
  try {
    message = answer.json ? String(JSON.parse(answer.json).message ?? '') || null : null
  } catch {
    message = null
  }
  return json({
    ok: !!answer.json,
    provider,
    model: ai.lastModel ?? modelFor(config, provider),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    message,
    problem: answer.json ? null : answer.problem,
  })
})
