// Sends a data-only FCM v1 push notification to a user's registered devices.
// Body: { userId: string, title: string, message: string, data?: Record<string,string> }
// Requires FCM_SERVICE_ACCOUNT secret (the Firebase service-account JSON).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_SA = Deno.env.get('FCM_SERVICE_ACCOUNT')!

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const { userId, title, message, data } = await req.json()
    if (!userId || !title || !message) {
      return new Response(JSON.stringify({ error: 'userId, title, message required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // --- Authentication & authorization ---------------------------------
    // Callers must present a bearer token. We accept:
    //   1. The service role key — used by DB triggers (push_on_new_message,
    //      push_on_new_notification) and other trusted server code.
    //   2. A signed-in user JWT, provided the caller is authorized to push
    //      to `userId`: admins, self-tests, or an existing conversation
    //      participant with the target user.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE)

    if (token !== SERVICE_ROLE) {
      const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(token)
      const callerId = claimsData?.claims?.sub as string | undefined
      if (claimsErr || !callerId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      let authorized = callerId === userId // self-test
      if (!authorized) {
        const { data: isAdmin } = await supa.rpc('is_admin', { _user_id: callerId })
        if (isAdmin === true) authorized = true
      }
      if (!authorized) {
        // Conversation participant with the target user?
        const { data: convo } = await supa
          .from('conversations')
          .select('id')
          .or(
            `and(user1_id.eq.${callerId},user2_id.eq.${userId}),` +
            `and(user1_id.eq.${userId},user2_id.eq.${callerId})`,
          )
          .limit(1)
          .maybeSingle()
        if (convo) authorized = true
      }
      if (!authorized) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }
    // --------------------------------------------------------------------

    const { data: rows, error } = await supa
      .from('device_push_tokens')
      .select('token, platform')
      .eq('user_id', userId)
    if (error) throw error
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const sa = JSON.parse(FCM_SA) as ServiceAccount
    const accessToken = await getAccessToken(sa)
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

    // DATA-ONLY payload — required for reliable background delivery and to
    // let the native app render the notification itself (mirrors the
    // "bulletproof" pattern: no `notification` object).
    const payloadData: Record<string, string> = {
      title: String(title),
      message: String(message),
      ...(data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      ) : {}),
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

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.ok).length, results }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
