// Sends a data-only FCM v1 push notification to a user's registered devices.
// Body: { userId: string, title: string, message: string, data?: Record<string,string> }
// Members may not choose the text of an alert sent to someone else; see the
// authorization notes in the handler.
// Requires FCM_SERVICE_ACCOUNT secret (the Firebase service-account JSON).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  UUID_RE,
  buildCallPush,
  parseCallRequest,
  sanitizeFreePush,
  type PushContent,
} from '../_shared/push-policy.ts'
import { withinRateLimit } from '../_shared/rate-limit.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_SA = Deno.env.get('FCM_SERVICE_ACCOUNT')!

// Internal token used by the database push triggers. It lives in Vault
// (read via the service-role-only get_push_internal_secret()), so rotating it
// in the database takes effect here without redeploying or env changes.
let cachedInternalSecret: { value: string; at: number } | null = null
const INTERNAL_SECRET_TTL_MS = 60_000

// deno-lint-ignore no-explicit-any
async function loadInternalSecret(supa: any, force = false): Promise<string> {
  if (!force && cachedInternalSecret && Date.now() - cachedInternalSecret.at < INTERNAL_SECRET_TTL_MS) {
    return cachedInternalSecret.value
  }
  const { data, error } = await supa.rpc('get_push_internal_secret')
  if (error) {
    console.error('could not load push internal secret', error.message)
    return cachedInternalSecret?.value ?? ''
  }
  cachedInternalSecret = { value: typeof data === 'string' ? data : '', at: Date.now() }
  return cachedInternalSecret.value
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// deno-lint-ignore no-explicit-any
async function isInternalToken(supa: any, token: string): Promise<boolean> {
  if (timingSafeEqual(token, await loadInternalSecret(supa))) return true
  // A JWT (user/service token) is never the internal token; don't refetch for it.
  if (token.split('.').length === 3) return false
  // Cache may predate a rotation: re-read once before refusing.
  return timingSafeEqual(token, await loadInternalSecret(supa, true))
}

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
  token_uri: string
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let s = btoa(String.fromCharCode(...bytes))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)),
  )
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const json = await res.json()
  if (!res.ok) throw new Error('FCM token error: ' + JSON.stringify(json))
  return json.access_token as string
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const body = await req.json().catch(() => null)
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    if (!UUID_RE.test(userId)) return jsonRes({ error: 'valid userId required' }, 400)

    // --- Authentication & authorization ---------------------------------
    // Callers must present a bearer token. We accept:
    //   1. The service role key or the internal Vault token: database push
    //      triggers (new message, new notification) and other trusted server
    //      code. Those events are already authorized where they happen.
    //   2. A signed-in member, who may only:
    //      - test on their own devices,
    //      - (admins) send a custom alert,
    //      - alert the person they are calling right now. The call must exist
    //        in call_sessions (caller -> recipient, under 2 minutes old), the
    //        two must share a conversation and neither may have blocked the
    //        other. The server writes the alert text; anything the member
    //        sent as title/message is ignored.
    //   Every member path is rate limited.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return jsonRes({ error: 'Unauthorized' }, 401)

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE)

    let content: PushContent | null = null
    const isInternalCaller = token === SERVICE_ROLE || (await isInternalToken(supa, token))
    if (isInternalCaller) {
      const { title, message, data } = body ?? {}
      if (!title || !message) return jsonRes({ error: 'userId, title, message required' }, 400)
      content = {
        title: String(title),
        message: String(message),
        data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
      }
    } else {
      const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(token)
      const callerId = claimsData?.claims?.sub as string | undefined
      if (claimsErr || !callerId || claimsData?.claims?.role !== 'authenticated') {
        return jsonRes({ error: 'Unauthorized' }, 401)
      }

      const { data: isAdmin } = await supa.rpc('is_admin', { _user_id: callerId })
      if (callerId === userId || isAdmin === true) {
        const max = isAdmin === true ? 30 : 10
        if (!(await withinRateLimit(supa, `uid:${callerId}`, 'push-free', max, 60))) {
          return jsonRes({ error: 'Too many alerts, try again shortly' }, 429)
        }
        content = sanitizeFreePush(body)
        if (!content) return jsonRes({ error: 'title and message required' }, 400)
      } else {
        const call = parseCallRequest(body)
        if (!call) return jsonRes({ error: 'Forbidden' }, 403)

        const since = new Date(Date.now() - 2 * 60_000).toISOString()
        const { data: session } = await supa
          .from('call_sessions')
          .select('id')
          .eq('call_id', call.callId)
          .eq('caller_id', callerId)
          .eq('callee_id', userId)
          .gte('created_at', since)
          .limit(1)
          .maybeSingle()
        if (!session) return jsonRes({ error: 'Forbidden' }, 403)

        const { data: convo } = await supa
          .from('conversations')
          .select('id')
          .or(
            `and(user1_id.eq.${callerId},user2_id.eq.${userId}),` +
            `and(user1_id.eq.${userId},user2_id.eq.${callerId})`,
          )
          .limit(1)
          .maybeSingle()
        if (!convo) return jsonRes({ error: 'Forbidden' }, 403)

        const { data: blocks } = await supa
          .from('relationship_blocks')
          .select('id')
          .or(
            `and(user_id.eq.${callerId},blocked_id.eq.${userId}),` +
            `and(user_id.eq.${userId},blocked_id.eq.${callerId})`,
          )
          .limit(1)
        if (blocks?.length) return jsonRes({ error: 'Forbidden' }, 403)

        // One alert per call (plus one retry), and a cap per caller.
        const perCall = await withinRateLimit(supa, `call:${call.callId}`, 'push-call-once', 2, 3600)
        const perCaller = await withinRateLimit(supa, `uid:${callerId}`, 'push-call', 10, 600)
        if (!perCall || !perCaller) return jsonRes({ error: 'Too many call alerts, try again shortly' }, 429)

        const { data: profile } = await supa.from('profiles').select('display_name, username').eq('id', callerId).maybeSingle()
        content = buildCallPush({
          callerId,
          callerName: profile?.display_name || profile?.username,
          callId: call.callId,
          callType: call.callType,
          conversationId: convo.id,
        })
      }
    }
    // --------------------------------------------------------------------

    const { data: rows, error } = await supa
      .from('device_push_tokens')
      .select('token, platform')
      .eq('user_id', userId)
    if (error) throw error
    if (!rows || rows.length === 0) return jsonRes({ sent: 0, reason: 'no tokens' })

    const sa = JSON.parse(FCM_SA) as ServiceAccount
    const accessToken = await getAccessToken(sa)
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

    // DATA-ONLY payload — required for reliable background delivery and to
    // let the native app render the notification itself (mirrors the
    // "bulletproof" pattern: no `notification` object).
    const payloadData: Record<string, string> = {
      ...content.data,
      title: content.title,
      message: content.message,
    }

    const results = await Promise.all(rows.map(async (r) => {
      const body = {
        message: {
          token: r.token,
          // DATA-ONLY payload — required for reliable background delivery and
          // to ensure onMessageReceived fires in the native app shell in all
          // states (foreground, background, killed).
          data: payloadData,
          android: {
            priority: 'HIGH' as const,
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { 'content-available': 1 } },
          },
        },
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const ok = res.ok
      // Clean up dead tokens
      if (!ok) {
        const txt = await res.text()
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(txt)) {
          await supa.from('device_push_tokens').delete().eq('token', r.token)
        }
        return { token: r.token, ok: false, status: res.status }
      }
      return { token: r.token, ok: true }
    }))

    // Device tokens stay on the server; callers only learn how many got it.
    const sent = results.filter((r) => r.ok).length
    return jsonRes({ sent, failed: results.length - sent })
  } catch (e) {
    console.error('send-push failed', e instanceof Error ? e.message : String(e))
    return jsonRes({ error: 'Push failed' }, 500)
  }
})
