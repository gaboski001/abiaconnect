// Admin-only: approve, decline or ignore a volunteer application
// (Admin -> Volunteer Applications). Approving or declining emails the
// applicant; ignoring sends nothing.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLog } from '../_shared/transactional-email-templates/log-send.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ERRORS: Record<string, string> = {
  not_found: 'This application no longer exists.',
  already_decided: 'This application was already approved or declined, and the applicant has been told.',
  note_too_long: 'The note is too long (1,000 characters at most).',
  decision_invalid: 'Unknown action.',
}

const ROLE_NAMES: Record<string, string> = {
  moderator: 'Community Moderator',
  writer: 'Content Writer',
  social: 'Social Media Coordinator',
  developer: 'Developer',
  connector: 'Community Connector',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } })
  const { data: claims } = await userClient.auth.getClaims(auth.replace('Bearer ', ''))
  const adminId = claims?.claims?.sub as string | undefined
  if (!adminId) return json({ error: 'Unauthorized' }, 401)
  const { data: isAdmin } = await userClient.rpc('is_admin', { _user_id: adminId })
  if (!isAdmin) return json({ error: 'Forbidden' }, 403)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }
  const decision = typeof body?.decision === 'string' ? body.decision : ''
  const note = typeof body?.note === 'string' ? body.note : ''
  if (typeof body?.id !== 'string') return json({ error: 'Invalid request' }, 400)

  const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const { data: app, error } = await db.rpc('volunteer_decide', {
    _id: body.id,
    _decision: decision,
    _admin: adminId,
    _note: note,
  })
  if (error) {
    const known = Object.keys(ERRORS).find((k) => (error.message ?? '').includes(k))
    if (known) return json({ error: ERRORS[known] }, 400)
    console.error('volunteer_decide failed', { code: error.code, message: error.message })
    return json({ error: 'Could not save the decision. Please try again.' }, 500)
  }

  if (decision === 'ignore') return json({ ok: true, status: app.status, emailed: false })

  let emailed = false
  try {
    const outcome = await sendAndLog(db, decision === 'approve' ? 'volunteer-approved' : 'volunteer-declined', app.email, {
      idempotencyKey: `volunteer-${decision}-${app.id}`,
      templateData: { name: app.full_name, role: ROLE_NAMES[app.role], note: app.admin_note ?? undefined },
    })
    emailed = outcome === 'sent'
    if (emailed) {
      await db.from('volunteer_applications').update({ decision_emailed_at: new Date().toISOString() }).eq('id', app.id)
    }
  } catch (e) {
    console.error('volunteer decision email failed', { message: e instanceof Error ? e.message : String(e) })
  }

  return json({ ok: true, status: app.status, emailed })
})
