// Admin-only: renders a registered transactional email template to HTML so
// admins can preview emails (e.g. the birthday greeting) in the dashboard.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)

  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin', {
    _user_id: userData.user.id,
  })
  if (adminErr || !isAdmin) return json({ error: 'Forbidden' }, 403)

  let templateName = ''
  let templateData: Record<string, unknown> = {}
  try {
    const body = await req.json()
    templateName = String(body.templateName ?? '')
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const entry = TEMPLATES[templateName]
  if (!entry) return json({ error: `Unknown template '${templateName}'` }, 404)

  const data = { ...(entry.previewData ?? {}), ...templateData }
  try {
    const html = await renderAsync(React.createElement(entry.component, data))
    const subject =
      typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
    return json({ templateName, subject, html })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
