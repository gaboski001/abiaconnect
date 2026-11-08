// Live rooms: hands out passes to a room on the live service and applies the
// host's and moderators' actions there.
//
// Every action is first checked by the database (the live_* functions, called
// as the signed-in member), so the rules live in one place. Only then is the
// live service told.
//
// Needs these project secrets, from the live service's project settings:
//   LIVEKIT_URL         e.g. wss://abiaconnect-xxxx.livekit.cloud
//   LIVEKIT_API_KEY
//   LIVEKIT_API_SECRET
// Without them every action answers "not_set_up" and nothing else happens.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { AccessToken, RoomServiceClient, TrackSource } from 'npm:livekit-server-sdk@2.19.2'
import { withinRateLimit } from '../_shared/rate-limit.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LIVE_URL = Deno.env.get('LIVEKIT_URL') ?? ''
const LIVE_KEY = Deno.env.get('LIVEKIT_API_KEY') ?? ''
const LIVE_SECRET = Deno.env.get('LIVEKIT_API_SECRET') ?? ''

// A pass lasts a little longer than the longest room.
const PASS_SECONDS = 5 * 60 * 60

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// The database's reason codes (e.g. "stage_full") go back to the app as is.
function dbError(message: string) {
  const code = (message.match(/^([a-z_]+(?::[a-z_0-9]+)?)/) ?? [])[1] ?? 'failed'
  return json({ error: code }, 400)
}

function permission(role: string) {
  const speaks = role !== 'listener'
  return {
    canSubscribe: true,
    canPublish: speaks,
    canPublishData: false,
    canPublishSources: speaks ? [TrackSource.MICROPHONE] : [],
  }
}

// The member may not be connected right now; that is fine.
async function quietly(work: Promise<unknown>) {
  try {
    await work
  } catch (e) {
    console.log('live service:', (e as Error).message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const asMember = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: claims, error: claimErr } = await asMember.auth.getClaims(token)
  const uid = claims?.claims?.sub as string | undefined
  if (claimErr || !uid) return json({ error: 'unauthorized' }, 401)

  if (!LIVE_URL || !LIVE_KEY || !LIVE_SECRET) return json({ error: 'not_set_up' }, 503)

  const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  if (!(await withinRateLimit(service, `uid:${uid}`, 'live-room', 240, 3600))) {
    return json({ error: 'slow_down' }, 429)
  }

  let body: { action?: string; room_id?: string; user_id?: string; role?: string; block?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  const roomId = String(body.room_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(roomId)) return json({ error: 'bad request' }, 400)
  const target = body.user_id ? String(body.user_id) : ''
  if (target && !/^[0-9a-f-]{36}$/i.test(target)) return json({ error: 'bad request' }, 400)

  const rooms = new RoomServiceClient(LIVE_URL.replace(/^ws/, 'http'), LIVE_KEY, LIVE_SECRET)

  switch (body.action) {
    case 'join': {
      const { data: role, error } = await asMember.rpc('live_join_room', { _room_id: roomId })
      if (error) return dbError(error.message)
      if (role === 'host') {
        // Room closes on the live service soon after everyone leaves.
        await quietly(rooms.createRoom({ name: roomId, emptyTimeout: 300, departureTimeout: 60 }))
      }
      const { data: profile } = await service.from('profiles').select('display_name, username').eq('id', uid).maybeSingle()
      const pass = new AccessToken(LIVE_KEY, LIVE_SECRET, {
        identity: uid,
        name: profile?.display_name || profile?.username || 'Member',
        ttl: PASS_SECONDS,
      })
      pass.addGrant({ room: roomId, roomJoin: true, ...permission(String(role)) })
      return json({ url: LIVE_URL, token: await pass.toJwt(), role })
    }

    case 'set_role': {
      if (!target) return json({ error: 'bad request' }, 400)
      const { data: role, error } = await asMember.rpc('live_set_role', {
        _room_id: roomId,
        _user_id: target,
        _role: String(body.role ?? ''),
      })
      if (error) return dbError(error.message)
      await quietly(rooms.updateParticipant(roomId, target, undefined, permission(String(role))))
      return json({ role })
    }

    case 'remove': {
      if (!target) return json({ error: 'bad request' }, 400)
      const { error } = await asMember.rpc('live_remove_person', {
        _room_id: roomId,
        _user_id: target,
        _block: body.block === true,
      })
      if (error) return dbError(error.message)
      await quietly(rooms.removeParticipant(roomId, target))
      return json({ ok: true })
    }

    case 'mute': {
      if (!target) return json({ error: 'bad request' }, 400)
      const { data: mine } = await service.rpc('live_role_of', { _room_id: roomId, _uid: uid })
      if (mine !== 'host' && mine !== 'moderator') return json({ error: 'not_allowed' }, 403)
      const { data: theirs } = await service.rpc('live_role_of', { _room_id: roomId, _uid: target })
      if (theirs === 'host' || (mine === 'moderator' && theirs === 'moderator')) return json({ error: 'not_allowed' }, 403)
      try {
        const person = await rooms.getParticipant(roomId, target)
        for (const track of person.tracks ?? []) {
          if (track.source === TrackSource.MICROPHONE && !track.muted) {
            await rooms.mutePublishedTrack(roomId, target, track.sid, true)
          }
        }
      } catch (e) {
        console.log('live service:', (e as Error).message)
      }
      return json({ ok: true })
    }

    case 'end': {
      const { error } = await asMember.rpc('live_end_room', { _room_id: roomId })
      if (error) return dbError(error.message)
      await quietly(rooms.deleteRoom(roomId))
      return json({ ok: true })
    }

    default:
      return json({ error: 'bad request' }, 400)
  }
})
