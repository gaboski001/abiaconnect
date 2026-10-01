// Shared service-role JWT verification helper.
// Verifies the JWT signature using SUPABASE_JWT_SECRET (HS256) so functions
// deployed with verify_jwt=false cannot be tricked by a forged payload.

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get('Authorization')
  if (!h?.startsWith('Bearer ')) return null
  return h.slice('Bearer '.length).trim()
}

export function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1]))) as Record<string, unknown>
  } catch {
    return null
  }
}

async function verifyHs256(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts
  let header: Record<string, unknown>
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)))
  } catch {
    return null
  }
  if (header.alg !== 'HS256') return null
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const sig = b64urlToBytes(sigB64)
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      sig.buffer as ArrayBuffer,
      data.buffer as ArrayBuffer,
    )
    if (!ok) return null
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as Record<string, unknown>
    const exp = typeof claims.exp === 'number' ? claims.exp : null
    if (exp !== null && Date.now() / 1000 > exp) return null
    return claims
  } catch {
    return null
  }
}

// Returns null when caller is authorised as service_role. Otherwise returns a
// Response that the handler should return verbatim.
export async function requireServiceRole(req: Request): Promise<Response | null> {
  const headers = { 'Content-Type': 'application/json' }
  const token = getBearerToken(req)
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }
  const secret = Deno.env.get('SUPABASE_JWT_SECRET')
  if (!secret) {
    // Fail closed when the verification secret is missing.
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers })
  }
  const claims = await verifyHs256(token, secret)
  if (!claims || claims.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers })
  }
  return null
}
