import { supabase } from '@/lib/supabase'

export type ModerationSurface = 'thread' | 'reply' | 'message' | 'subgroup'

export interface ModerationResult {
  allowed: boolean
  /** allow, warn (may post, with a suggestion) or block. */
  verdict?: 'allow' | 'warn' | 'block'
  reason?: string
  /** Ugo's tip for rewording. */
  suggestion?: string
  categories?: string[]
  degraded?: boolean
}

/** The AI moderator's name, shown to members. */
export const MODERATOR_NAME = 'Ugo'

/**
 * Calls the AI moderation edge function. Fail-open on infra errors so legitimate
 * users are never blocked by a network/AI outage — the decision is still logged
 * server-side for admin review.
 */
export async function moderateContent(
  surface: ModerationSurface,
  content: string,
  title?: string,
): Promise<ModerationResult> {
  const trimmed = (content ?? '').trim()
  // Skip very short messages (emoji, "ok", "thanks") to save credits & latency.
  if (trimmed.length < 8) return { allowed: true, degraded: true }

  try {
    const { data, error } = await supabase.functions.invoke('moderate-thread', {
      body: { surface, title, content: trimmed },
    })
    if (error || !data) return { allowed: true, degraded: true }
    const allowed = data.allowed !== false
    return {
      allowed,
      verdict: data.verdict ?? (allowed ? 'allow' : 'block'),
      reason: data.reason ?? undefined,
      suggestion: data.suggestion ?? undefined,
      categories: data.categories,
      degraded: !!data.degraded,
    }
  } catch {
    return { allowed: true, degraded: true }
  }
}
