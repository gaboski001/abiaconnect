// Shared service-role JWT verification helper.
// Use to protect internal-only edge functions invoked by pg_cron, triggers, or
// other server-side callers. Rejects anon JWTs and unauthenticated requests.

export function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization')
  if (!h?.startsWith('Bearer ')) return null
  return h.slice('Bearer '.length).trim()
}

// Returns null when caller is authorised as service_role. Otherwise returns a
// Response that the handler should return verbatim.
export function requireServiceRole(req: Request): Response | null {
  const token = getBearerToken(req)
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
