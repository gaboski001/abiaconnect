// Ugo, AbiaConnect's AI Community Guardian: checks content before it is posted.
// Body: { title?: string, content: string, surface?: 'thread' | 'reply' | 'message' | 'subgroup' }
// Returns: { allowed, verdict: 'allow'|'warn'|'block', reason?, suggestion?, categories, severity, moderator }
// "allowed" is kept for older app versions (warn => allowed: true).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { UGO_NAME, contentHash, stripHtml, ugoReview, type Surface } from '../_shared/ugo.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SURFACES: Surface[] = ['thread', 'reply', 'message', 'subgroup']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const surface: Surface = SURFACES.includes(body?.surface) ? body.surface : 'thread'
    const title = String(body?.title ?? '').slice(0, 300)
    const content = String(body?.content ?? '').slice(0, 20000)

    // Who is posting (for the audit log and to recognise checked content later).
    let userId: string | null = null
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (token) {
      try {
        const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        })
        const { data } = await userClient.auth.getClaims(token)
        userId = (data?.claims?.sub as string | undefined) ?? null
      } catch {
        /* anonymous */
      }
    }

    const decision = await ugoReview({ surface, title, content })
    const allowed = decision.verdict !== 'block'

    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
      await admin.from('moderation_log').insert({
        user_id: userId,
        surface,
        allowed,
        reason: decision.reason,
        categories: decision.categories,
        title,
        content_excerpt: stripHtml(content).slice(0, 1000),
        degraded: decision.degraded,
        verdict: decision.verdict,
        actor: 'pre_check',
        content_hash: userId && allowed ? await contentHash(userId, content) : null,
      })
    } catch {
      /* logging never blocks the member */
    }

    return Response.json(
      {
        allowed,
        verdict: decision.verdict,
        reason: decision.reason,
        suggestion: decision.suggestion,
        categories: decision.categories,
        severity: decision.severity,
        degraded: decision.degraded,
        moderator: UGO_NAME,
      },
      { headers: cors },
    )
  } catch (err) {
    return Response.json({ allowed: true, verdict: 'allow', degraded: true, error: String(err) }, { headers: cors })
  }
})
