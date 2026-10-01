// Ugo — running a review: built-in safety rules first, then the AI.
// Fails open (allows) when the AI is unavailable, except for what the
// built-in rules catch; every decision says whether it was "degraded".
import {
  buildSystemPrompt,
  buildUserMessage,
  normalizeForHash,
  parseDecision,
  ruleBasedCheck,
  type ReviewInput,
  type UgoDecision,
} from './ugo-core.ts'

export * from './ugo-core.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const MODEL = 'google/gemini-3-flash-preview'

export interface UgoResult extends UgoDecision {
  degraded: boolean
  status?: number
}

const ALLOW_DEGRADED: UgoResult = {
  verdict: 'allow',
  severity: 'none',
  categories: [],
  reason: null,
  suggestion: null,
  confidence: 0,
  degraded: true,
}

export async function ugoReview(input: ReviewInput): Promise<UgoResult> {
  const text = `${input.title ?? ''}\n${input.content}`
  const rule = ruleBasedCheck(text)
  // A clear money scam is blocked even before asking the AI (and even when an
  // appeal or report is being reviewed, the rule still applies).
  if (rule) return { ...rule, degraded: false }

  if (!LOVABLE_API_KEY) return ALLOW_DEGRADED
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: buildSystemPrompt(input.surface) },
          { role: 'user', content: buildUserMessage(input) },
        ],
        response_format: { type: 'json_object' },
      }),
    }).finally(() => clearTimeout(timer))
    if (!res.ok) return { ...ALLOW_DEGRADED, status: res.status }
    const data = await res.json()
    const decision = parseDecision(data?.choices?.[0]?.message?.content ?? '')
    return decision ? { ...decision, degraded: false } : ALLOW_DEGRADED
  } catch {
    return ALLOW_DEGRADED
  }
}

/** Fingerprint of who posted what, so already-checked content isn't re-reviewed. */
export async function contentHash(userId: string, content: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${normalizeForHash(content)}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
