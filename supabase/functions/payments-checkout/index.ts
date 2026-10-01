// Starts a checkout for a dating subscription plan with an admin-enabled
// payment provider (Paystack, Monnify or Squad). The price is read from the
// plan row in the database, never from the client.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { PROVIDERS, type Provider } from '../_shared/payment-core.ts'
import { initializePayment, ProviderError, type ProviderRow, loadPaymentSecrets } from '../_shared/payment-providers.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Where providers send the customer back. Fixed server-side (never taken from
// the request) so a checkout can't be pointed at another site.
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://abiaconnect.com').replace(/\/+$/, '')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({
  planId: z.string().uuid(),
  provider: z.enum(PROVIDERS as [Provider, ...Provider[]]).optional(),
})

// Friendly messages for errors raised by payment_create_transaction().
const FRIENDLY: Record<string, string> = {
  account_restricted: 'Your account cannot make purchases right now. Please contact support.',
  provider_unavailable: 'That payment method is not available right now.',
  plan_unavailable: 'This plan is not available right now.',
  too_many_checkouts: 'Too many payment attempts. Please wait a little and try again.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser(auth.replace('Bearer ', ''))
  const user = userData?.user
  if (userErr || !user?.email) return json({ error: 'Unauthorized' }, 401)

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: 'Invalid request' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE)
  await loadPaymentSecrets(admin)

  const { data: enabled } = await admin
    .from('payment_providers')
    .select('provider, is_enabled, mode, contract_code')
    .eq('is_enabled', true)
    .order('sort_order')
  const providers = (enabled ?? []) as ProviderRow[]
  if (!providers.length) return json({ error: 'Payments are not available right now.' }, 503)

  const chosen = parsed.data.provider
    ? providers.find((p) => p.provider === parsed.data.provider)
    : providers.length === 1
      ? providers[0]
      : undefined
  if (!chosen) return json({ error: 'Please choose a payment method.' }, 400)

  const { data: tx, error: txErr } = await admin
    .rpc('payment_create_transaction', { _user: user.id, _plan_id: parsed.data.planId, _provider: chosen.provider })
    .single()
  if (txErr || !tx) {
    const code = Object.keys(FRIENDLY).find((k) => txErr?.message?.includes(k))
    if (!code) console.error('create transaction failed', txErr)
    return json({ error: code ? FRIENDLY[code] : 'Could not start the payment. Please try again.' }, code ? 400 : 500)
  }

  const { data: profile } = await admin.from('profiles').select('display_name, username').eq('id', user.id).maybeSingle()
  const { data: plan } = await admin.from('subscription_plans').select('name').eq('id', parsed.data.planId).maybeSingle()

  try {
    const t = tx as { reference: string; amount_minor: number; currency: string }
    const result = await initializePayment(admin, chosen, {
      reference: t.reference,
      amountMinor: Number(t.amount_minor),
      currency: t.currency,
      email: user.email,
      customerName: profile?.display_name || profile?.username || user.email.split('@')[0],
      description: `AbiaConnect ${plan?.name ?? 'Premium'}`,
      // No query string: providers append their own (Paystack: trxref/reference,
      // Monnify: paymentReference); the callback page reads any of them.
      callbackUrl: `${SITE_URL}/relationship/payment/callback`,
    })
    await admin.rpc('payment_attach_checkout', {
      _reference: t.reference,
      _provider_reference: result.providerReference,
      _checkout_url: result.checkoutUrl,
    })
    return json({ checkoutUrl: result.checkoutUrl, reference: t.reference })
  } catch (e) {
    console.error('initialize failed', e instanceof Error ? e.message : e)
    await admin
      .from('payment_transactions')
      .update({ status: 'failed', failure_reason: 'initialize_failed' })
      .eq('reference', (tx as { reference: string }).reference)
      .eq('status', 'pending')
    const msg = e instanceof ProviderError ? 'The payment provider is unavailable right now. Please try again.' : 'Could not start the payment.'
    return json({ error: msg }, 502)
  }
})
