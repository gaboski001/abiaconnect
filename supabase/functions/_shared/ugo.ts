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
import { askAiJson } from './ai.ts'

export * from './ugo-core.ts'

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

  try {
    // The AI chosen on the Admin portal's AI provider page (Lovable AI as backup).
    const answer = await askAiJson(
      'moderation',
      { system: buildSystemPrompt(input.surface), user: buildUserMessage(input), temperature: 0 },
      { timeoutMs: 12_000 },
    )
    const decision = answer.json ? parseDecision(answer.json) : null
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
