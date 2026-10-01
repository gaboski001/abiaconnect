// Returns ICE servers (STUN + TURN relay) for voice/video calls.
//
// STUN alone cannot connect two phones behind strict / carrier-grade NAT (very
// common on mobile data), so calls ring but never connect or have no audio.
// A TURN relay fixes that. Configure ONE of these in the project secrets:
//
//   Cloudflare Realtime TURN (recommended, generous free tier):
//     CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
//   Any other TURN provider (Metered, Twilio, self-hosted coturn, ...):
//     TURN_URLS (comma separated, e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"),
//     TURN_USERNAME, TURN_CREDENTIAL
//
// Without either, only STUN is returned (calls still work on friendly networks).
// Signed-in users only, so relay credentials can't be harvested anonymously.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const STUN: RTCIceServerLike[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
]

interface RTCIceServerLike {
  urls: string | string[]
  username?: string
  credential?: string
}

const TTL_SECONDS = 6 * 60 * 60

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function cloudflareServers(keyId: string, token: string): Promise<RTCIceServerLike[]> {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL_SECONDS }),
    },
  )
  if (!res.ok) throw new Error(`cloudflare turn ${res.status}`)
  const body = await res.json()
  // The API returns `iceServers` as one object; accept an array too.
  const list = Array.isArray(body?.iceServers) ? body.iceServers : body?.iceServers ? [body.iceServers] : []
  return list.filter((s: RTCIceServerLike) => s && s.urls)
}

function staticServers(): RTCIceServerLike[] {
  const urls = (Deno.env.get('TURN_URLS') ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  const username = Deno.env.get('TURN_USERNAME') ?? ''
  const credential = Deno.env.get('TURN_CREDENTIAL') ?? ''
  if (!urls.length || !username || !credential) return []
  return [{ urls, username, credential }]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const supa = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await supa.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)

  let turn: RTCIceServerLike[] = []
  let source = 'stun-only'
  const keyId = Deno.env.get('CLOUDFLARE_TURN_KEY_ID')
  const apiToken = Deno.env.get('CLOUDFLARE_TURN_API_TOKEN')
  try {
    if (keyId && apiToken) {
      turn = await cloudflareServers(keyId, apiToken)
      source = 'cloudflare'
    }
  } catch (e) {
    console.error('TURN credential request failed', (e as Error).message)
  }
  if (!turn.length) {
    turn = staticServers()
    if (turn.length) source = 'static'
  }

  return json({ iceServers: [...STUN, ...turn], ttl: TTL_SECONDS, source })
})
