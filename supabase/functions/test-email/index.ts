import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'npm:emailjs@4.0.3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let configuredHost = 'the configured SMTP host'
  let configuredPort = 'the configured SMTP port'

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)

    const { data: isAdminData, error: roleErr } = await admin.rpc('is_admin', {
      _user_id: userData.user.id,
    })
    if (roleErr || !isAdminData) return json({ error: 'Forbidden' }, 403)

    const { data: rows, error: settingsErr } = await admin
      .from('site_settings')
      .select('key,value')
      .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from'])
    if (settingsErr) return json({ error: settingsErr.message }, 500)

    const s: Record<string, string> = {}
    for (const r of rows ?? []) s[r.key] = String(r.value ?? '')

    if (!s.smtp_host || !s.smtp_user || !s.smtp_password || !s.smtp_from) {
      return json(
        { error: 'SMTP configuration is incomplete. Fill in host, user, password, and from address.' },
        400,
      )
    }

    const to = userData.user.email
    if (!to) return json({ error: 'No recipient email on your account' }, 400)

    configuredHost = s.smtp_host
    configuredPort = String(s.smtp_port || 587)

    const client = new SMTPClient({
      user: s.smtp_user,
      password: s.smtp_password,
      host: s.smtp_host,
      port: Number(s.smtp_port || 587),
      tls: true,
    })

    await client.sendAsync({
      from: s.smtp_from,
      to,
      subject: 'AbiaConnect test email',
      text: 'This is a test email from your AbiaConnect admin panel. If you received this, SMTP is configured correctly.',
    })

    return json({ ok: true, sentTo: to })
  } catch (e) {
    console.error('test-email error', e)
    const message = (e as Error).message || 'Send failed'
    const cause = (e as { previous?: { code?: string; hostname?: string } }).previous
    const lowerMessage = message.toLowerCase()

    if (message.includes('ENOTFOUND') || cause?.code === 'ENOTFOUND') {
      const host = cause?.hostname || 'the configured SMTP host'
      return json(
        {
          error: `SMTP host "${host}" could not be found. Enter the exact outgoing mail server from your email provider, then save and test again.`,
        },
        400,
      )
    }

    if (
      lowerMessage.includes('timedout') ||
      lowerMessage.includes('timed out') ||
      lowerMessage.includes('timeout') ||
      cause?.code === 'ETIMEDOUT'
    ) {
      return json(
        {
          error: `Could not connect to SMTP host "${configuredHost}" on port ${configuredPort}. The server did not respond, so enter a reachable outgoing SMTP server from your email provider and test again.`,
        },
        400,
      )
    }

    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
