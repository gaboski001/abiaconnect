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

/** What members see when a request failed because there is no internet. */
export const NO_NETWORK_MESSAGE = 'No internet connection. Check your network and try again.'

// Browser and app wordings for "the request never reached the server".
const NETWORK_FAILURE =
  /failed to fetch|networkerror|network request failed|network error|load failed|fetch failed|net::err_|err_internet_disconnected|err_name_not_resolved|err_connection|failed to send a request to the edge function|the internet connection appears to be offline/i

export function isNetworkFailure(value: unknown): boolean {
  const s = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? '')
  return NETWORK_FAILURE.test(s)
}

export function redact(value: unknown): string {
  if (value == null) return ''
  let s: string
  if (typeof value === 'string') s = value
  else if (value instanceof Error) s = value.message || value.name || 'Error'
  else {
    try { s = JSON.stringify(value) } catch { s = String(value) }
  }
  if (NETWORK_FAILURE.test(s)) return NO_NETWORK_MESSAGE
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
