// Permanently deletes the signed-in member's account (Google Play's account
// deletion requirement). Deleting the sign-in account removes every row
// linked to it with ON DELETE CASCADE (profile, messages, notifications,
// memberships, votes, tokens...); rows linked with ON DELETE SET NULL (for
// example public forum posts) stay, but no longer point to the member.
// Profile photos in the avatars bucket are removed too.
//
// POST { "confirm": "DELETE" } with the member's session.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { withinRateLimit } from '../_shared/rate-limit.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: claims } = await admin.auth.getClaims(token)
  const uid = claims?.claims?.sub as string | undefined
  if (!uid || claims?.claims?.role !== 'authenticated') return json({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm' }, 400)

  if (!(await withinRateLimit(admin, `uid:${uid}`, 'delete-account', 3, 3600, true))) {
    return json({ error: 'Too many attempts, try again later' }, 429)
  }

  // Profile photos: avatars/<uid>/...
  try {
    const { data: files } = await admin.storage.from('avatars').list(uid, { limit: 1000 })
    if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${uid}/${f.name}`))
  } catch (e) {
    console.error('avatar cleanup failed', e instanceof Error ? e.message : String(e))
  }

  const { error } = await admin.auth.admin.deleteUser(uid)
  if (error) {
    console.error('delete-account failed', error.message)
    return json({ error: 'Could not delete the account. Please contact support@abiaconnect.com.' }, 500)
  }
  return json({ ok: true })
})
