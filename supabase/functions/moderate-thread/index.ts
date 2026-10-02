// Ugo, AbiaConnect's AI Community Guardian: checks content before it is posted.
// Body: { title?: string, content: string, surface?: 'thread' | 'reply' | 'message' | 'subgroup' }
// Returns: { allowed, verdict: 'allow'|'warn'|'block', reason?, suggestion?, categories, severity, moderator }
// "allowed" is kept for older app versions (warn => allowed: true).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { UGO_NAME, contentHash, stripHtml, ugoReview, type Surface } from '../_shared/ugo.ts'
import { withinRateLimit } from '../_shared/rate-limit.ts'

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

    // Only signed-in members can run a check. Each check is written to the
    // moderation history under the member's own id, so anonymous callers
    // (public app key only) must not be able to add records or spend AI credits.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
    const { data: claims } = await admin.auth.getClaims(token)
    const userId = (claims?.claims?.sub as string | undefined) ?? null
    if (!userId || claims?.claims?.role !== 'authenticated') {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
    }
    if (!(await withinRateLimit(admin, `uid:${userId}`, 'moderate-thread', 20, 60))) {
      // The app treats this like an outage and lets the post through; Ugo's
      // background review still checks it after posting.
      return Response.json({ error: 'Too many checks, slow down' }, { status: 429, headers: cors })
    }

    const decision = await ugoReview({ surface, title, content })
    const allowed = decision.verdict !== 'block'

    try {
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
        content_hash: allowed && !decision.degraded ? await contentHash(userId, content) : null,
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
    console.error('moderate-thread failed', err instanceof Error ? err.message : String(err))
    return Response.json({ allowed: true, verdict: 'allow', degraded: true }, { headers: cors })
  }
})
