// Admin-only: reports which payment provider secrets are configured (never
// their values) and the webhook URL to paste into each provider dashboard.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { PROVIDERS } from '../_shared/payment-core.ts'
import { isConfigured, loadPaymentSecrets, SECRET_NAMES } from '../_shared/payment-providers.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } })
  const { data: claims } = await userClient.auth.getClaims(auth.replace('Bearer ', ''))
  const userId = claims?.claims?.sub
  if (!userId) return json({ error: 'Unauthorized' }, 401)
  const { data: isAdmin } = await userClient.rpc('is_admin', { _user_id: userId })
  if (!isAdmin) return json({ error: 'Forbidden' }, 403)

  await loadPaymentSecrets(createClient(SUPABASE_URL, SERVICE), { force: true })

  return json({
    siteUrlConfigured: !!Deno.env.get('PUBLIC_SITE_URL'),
    providers: PROVIDERS.map((provider) => ({
      provider,
      configured: { test: isConfigured(provider, 'test'), live: isConfigured(provider, 'live') },
      secretNames: SECRET_NAMES[provider],
      webhookUrl: `${SUPABASE_URL}/functions/v1/payments-webhook?provider=${provider}`,
    })),
  })
})
