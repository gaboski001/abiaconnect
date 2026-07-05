// Broadcast a "New app update available" push to all devices with a
// registered push token. Admin-only. Called by the admin UI right after a
// successful release upload.
//
// Body: { platform: 'android' | 'ios', version: string, changelog?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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
    'pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
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
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: cors })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(token)
    const callerId = claimsData?.claims?.sub as string | undefined
    if (claimsErr || !callerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const { data: isAdmin } = await supa.rpc('is_admin', { _user_id: callerId })
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { platform, version, changelog } = await req.json()
    if (!platform || !version || !['android', 'ios'].includes(platform)) {
      return new Response(JSON.stringify({ error: 'platform and version required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Target both native devices on this platform AND Android web browsers
    // (they register as platform='web' via the same push pipeline where
    // available). We include all tokens so users get one nudge to update.
    const targetPlatforms = platform === 'android' ? ['android', 'web'] : ['ios']
    const { data: rows, error } = await supa
      .from('device_push_tokens')
      .select('token, user_id, platform')
      .in('platform', targetPlatforms)
    if (error) throw error

    // Also drop an in-app notification for every distinct user so web users
    // who don't have push tokens still see a bell notification next login.
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)))
    if (userIds.length > 0) {
      const notifRows = userIds.map((uid) => ({
        user_id: uid,
        type: 'system',
        message: `A new ${platform === 'ios' ? 'iOS' : 'Android'} app update (v${version}) is available.`,
        link: '/download',
      }))
      // Best-effort — ignore failure
      await supa.from('notifications').insert(notifRows)
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const sa = JSON.parse(FCM_SA) as ServiceAccount
    const accessToken = await getAccessToken(sa)
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

    const title = 'App update available'
    const body = `Version ${version} is ready to install${changelog ? ` — ${String(changelog).slice(0, 120)}` : ''}.`

    const payloadData: Record<string, string> = {
      title,
      message: body,
      url: '/download',
      type: 'release',
      version: String(version),
      platform: String(platform),
    }

    const results = await Promise.all(rows.map(async (r) => {
      const fcmBody = {
        message: {
          token: r.token,
          data: payloadData,
          android: { priority: 'HIGH' as const },
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
        body: JSON.stringify(fcmBody),
      })
      if (!res.ok) {
        const txt = await res.text()
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(txt)) {
          await supa.from('device_push_tokens').delete().eq('token', r.token)
        }
        return { ok: false, status: res.status }
      }
      return { ok: true }
    }))

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.ok).length, total: results.length }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
