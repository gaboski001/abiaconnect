/**
 * Sanitize any string before it is rendered to the user.
 *
 * Strips:
 *  - Backend hostnames (e.g. *.supabase.co, *.supabase.in, *.lovableproject.com)
 *  - Storage signed-URL tokens (?token=…, &token=…, JWT-shaped strings)
 *  - Raw bearer tokens / api keys
 *  - Stack-trace lines ("at fn (file:line:col)") and "file.tsx:12:34" locations
 *  - Direct IPv4 addresses
 *
 * Used everywhere user-facing copy may include a raw error message.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // JWT-ish tokens (header.payload.signature)
  [/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted-token]'],
  // ?token= / &token= / access_token= / apikey= …
  [/([?&](?:token|access_token|refresh_token|apikey|api_key|key)=)[^&\s"'<>]+/gi, '$1[redacted]'],
  // Bearer headers in error strings
  [/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]'],
  // Supabase / Lovable backend hostnames (with optional scheme + path)
  [/https?:\/\/[a-z0-9-]+\.(?:supabase\.(?:co|in)|lovableproject\.com|lovable\.app)(?:\/[^\s"'<>]*)?/gi, '[backend]'],
  // Bare hostnames
  [/[a-z0-9-]+\.(?:supabase\.(?:co|in)|lovableproject\.com|lovable\.app)/gi, '[backend]'],
  // Stack frame lines: "at something (foo.ts:12:34)" or "foo.tsx:12:34"
  [/\bat\s+[^\n]+\([^)\n]*:\d+:\d+\)/g, ''],
  [/\b[\w./-]+\.(?:tsx?|jsx?|mjs|cjs):\d+:\d+/g, ''],
  // IPv4 addresses
  [/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[ip]'],
]

export function redact(value: unknown): string {
  if (value == null) return ''
  let s: string
  if (typeof value === 'string') s = value
  else if (value instanceof Error) s = value.message || value.name || 'Error'
  else {
    try { s = JSON.stringify(value) } catch { s = String(value) }
  }
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep)
  // Collapse whitespace introduced by removed stack frames
  s = s.replace(/[ \t]{2,}/g, ' ').replace(/\s*\n\s*\n+/g, '\n').trim()
  // Final safety: if string still contains very long base64-ish blobs, trim them.
  s = s.replace(/[A-Za-z0-9+/=_-]{60,}/g, '[redacted]')
  return s || 'Something went wrong. Please try again.'
}

/** Convenience wrapper for thrown errors. */
export function safeErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const out = redact(err)
  return out || fallback
}
