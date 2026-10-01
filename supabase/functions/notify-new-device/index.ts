import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendAndLog } from '../_shared/transactional-email-templates/log-send.ts'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Sends the "new device sign-in" email to the signed-in caller only.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userErr || !user?.email) return json({ error: 'Unauthorized' }, 401)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const device = typeof body?.device === 'string' ? body.device.slice(0, 200) : 'Unknown device'
  const when = typeof body?.when === 'string' ? body.when.slice(0, 100) : new Date().toUTCString()
  const fingerprint = typeof body?.fingerprint === 'string' ? body.fingerprint.slice(0, 200) : crypto.randomUUID()

  try {
    const outcome = await sendAndLog(supabase, 'new-device-login', user.email, {
      templateData: { device, when },
      idempotencyKey: `new-device-${user.id}-${fingerprint}`,
    })
    return json({ success: outcome === 'sent', outcome })
  } catch (e) {
    console.error('new-device email failed', { message: e instanceof Error ? e.message : String(e) })
    return json({ error: 'Failed to send email' }, 500)
  }
})
