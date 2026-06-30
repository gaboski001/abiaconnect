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
    if (!LOVABLE_API_KEY) {
      // Fail-open if AI not configured — don't block users.
      return Response.json({ allowed: true }, { headers: cors })
    }

    const { title, content } = await req.json()
    const text = `Title: ${String(title ?? '').slice(0, 300)}\n\nContent: ${String(content ?? '').replace(/<[^>]+>/g, ' ').slice(0, 4000)}`

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
      // Don't block posting on AI infra hiccups.
      return Response.json({ allowed: true, degraded: true, status: res.status }, { headers: cors })
    }

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed: { allowed?: boolean; reason?: string; categories?: string[] } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      return Response.json({ allowed: true, degraded: true }, { headers: cors })
    }

    return Response.json(
      {
        allowed: parsed.allowed !== false,
        reason: parsed.reason ?? null,
        categories: parsed.categories ?? [],
      },
      { headers: cors },
    )
  } catch (err) {
    return Response.json({ allowed: true, degraded: true, error: String(err) }, { headers: cors })
  }
})
