import { supabase } from '@/lib/supabase'

export type ModerationSurface = 'thread' | 'reply' | 'message' | 'subgroup'

export interface ModerationResult {
  allowed: boolean
  reason?: string
  categories?: string[]
  degraded?: boolean
}

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
    return {
      allowed: data.allowed !== false,
      reason: data.reason,
      categories: data.categories,
      degraded: !!data.degraded,
    }
  } catch {
    return { allowed: true, degraded: true }
  }
}
