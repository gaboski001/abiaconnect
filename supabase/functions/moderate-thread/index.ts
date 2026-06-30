// AI-powered moderation check for new threads.
// Body: { title: string, content: string }
// Returns: { allowed: boolean, reason?: string, categories?: string[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!


const SYSTEM_PROMPT = `You are a strict content moderator for AbiaConnect, a community forum for Abia State, Nigeria.

Review the user's thread for: hate speech, slurs, harassment, threats, sexual content, graphic violence, self-harm encouragement, doxxing, illegal activities, scams/phishing links, spam, or tribal/ethnic incitement.

Respect: respectful debate, criticism, cultural/political discussion, and constructive disagreement ARE allowed.

Respond with ONLY valid JSON in this exact shape (no markdown, no prose):
{"allowed": true|false, "reason": "short user-facing reason if not allowed", "categories": ["..."]}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const { title, content } = await req.json()
    const cleanContent = String(content ?? '').replace(/<[^>]+>/g, ' ')
    const text = `Title: ${String(title ?? '').slice(0, 300)}\n\nContent: ${cleanContent.slice(0, 4000)}`

    // Identify caller (best-effort) so we can attribute the log to a user.
    let userId: string | null = null
    try {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
          global: { headers: { Authorization: authHeader } },
        })
        const { data } = await userClient.auth.getUser()
        userId = data?.user?.id ?? null
      }
    } catch { /* ignore */ }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    const logDecision = async (allowed: boolean, reason: string | null, categories: string[], degraded: boolean) => {
      try {
        await admin.from('moderation_log').insert({
          user_id: userId,
          surface: 'thread',
          allowed,
          reason,
          categories,
          title: String(title ?? '').slice(0, 300),
          content_excerpt: cleanContent.slice(0, 1000),
          degraded,
        })
      } catch { /* never block the response */ }
    }

    if (!LOVABLE_API_KEY) {
      await logDecision(true, null, [], true)
      return Response.json({ allowed: true, degraded: true }, { headers: cors })
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (res.status === 429 || res.status === 402 || !res.ok) {
      await logDecision(true, `AI gateway ${res.status}`, [], true)
      return Response.json({ allowed: true, degraded: true, status: res.status }, { headers: cors })
    }

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed: { allowed?: boolean; reason?: string; categories?: string[] } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      await logDecision(true, 'AI returned unparseable JSON', [], true)
      return Response.json({ allowed: true, degraded: true }, { headers: cors })
    }

    const allowed = parsed.allowed !== false
    const reason = parsed.reason ?? null
    const categories = parsed.categories ?? []
    await logDecision(allowed, reason, categories, false)

    return Response.json({ allowed, reason, categories }, { headers: cors })
  } catch (err) {
    return Response.json({ allowed: true, degraded: true, error: String(err) }, { headers: cors })
  }
})

