/**
 * Map raw auth/backend errors to friendly, brand-safe messages.
 *
 * Backend errors can include host names ("tnwgnowjmrbjugheorkv.supabase.co"),
 * stack snippets, SQL fragments, or other internals we never want to show
 * users. This helper guarantees only a curated message ever reaches the UI.
 */
export type FriendlyAuthErrorKind =
  | 'expired'
  | 'invalid'
  | 'used'
  | 'missing'
  | 'network'
  | 'unknown'

const MAP: Record<FriendlyAuthErrorKind, string> = {
  expired: 'This link has expired. Please request a new one.',
  invalid: 'This link is invalid. Please request a new one.',
  used: 'This link has already been used. Please request a new one.',
  missing: 'This confirmation link is missing required information.',
  network: 'We couldn’t reach our servers. Check your connection and try again.',
  unknown: 'We couldn’t verify this link. Please request a new one.',
}

export function toFriendlyAuthError(raw: unknown): {
  kind: FriendlyAuthErrorKind
  message: string
} {
  const msg = (raw instanceof Error ? raw.message : String(raw ?? '')).toLowerCase()
  let kind: FriendlyAuthErrorKind = 'unknown'
  if (!msg) kind = 'unknown'
  else if (msg.includes('expired')) kind = 'expired'
  else if (msg.includes('already') || msg.includes('used')) kind = 'used'
  else if (msg.includes('invalid') || msg.includes('not found') || msg.includes('otp')) kind = 'invalid'
  else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to')) kind = 'network'
  return { kind, message: MAP[kind] }
}
