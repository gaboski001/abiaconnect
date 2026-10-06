// Starts an online donation with an admin-enabled payment provider (Paystack,
// Monnify or Squad). Works for signed-in members and visitors. The amount is
// checked by donation_create_transaction() in the database; the provider's
// payment is re-verified (payments-verify / payments-webhook) before the
// donation is confirmed.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { PROVIDERS, type Provider } from '../_shared/payment-core.ts'
import { initializePayment, ProviderError, type ProviderRow, loadPaymentSecrets } from '../_shared/payment-providers.ts'
import { clientIp, withinRateLimit } from '../_shared/rate-limit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Where providers send the donor back. Fixed server-side, never from the request.
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://abiaconnect.com').replace(/\/+$/, '')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({
  amount: z.number().finite().min(100).max(10_000_000), // NGN
  provider: z.enum(PROVIDERS as [Provider, ...Provider[]]).optional(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  message: z.string().trim().max(500).optional(),
  anonymous: z.boolean().optional(),
})

// Friendly messages for errors raised by donation_create_transaction().
const FRIENDLY: Record<string, string> = {
  provider_unavailable: 'That payment method is not available right now.',
  currency_unsupported: 'Donations are accepted in Naira (NGN).',
  amount_invalid: 'Please enter an amount between NGN 100 and NGN 10,000,000.',
  name_invalid: 'Please enter your name.',
  email_invalid: 'Please enter a valid email address.',
  message_too_long: 'Your message is too long (500 characters at most).',
  too_many_checkouts: 'Too many payment attempts. Please wait a little and try again.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  if (!(await withinRateLimit(admin, `ip:${clientIp(req)}`, 'donation-checkout', 10, 3600))) {
    return json({ error: FRIENDLY.too_many_checkouts }, 429)
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path?.[0]
    const msg =
      field === 'amount' ? FRIENDLY.amount_invalid
      : field === 'email' ? FRIENDLY.email_invalid
      : field === 'name' ? FRIENDLY.name_invalid
      : field === 'message' ? FRIENDLY.message_too_long
      : 'Invalid request'
    return json({ error: msg }, 400)
  }
  const input = parsed.data

  // Optional: link the donation to the signed-in member.
  let userId: string | null = null
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (token.split('.').length === 3) {
    const { data: claims } = await admin.auth.getClaims(token)
    if (claims?.claims?.role === 'authenticated' && claims.claims.sub) userId = String(claims.claims.sub)
  }

  await loadPaymentSecrets(admin)
  const { data: enabled } = await admin
    .from('payment_providers')
    .select('provider, is_enabled, mode, contract_code')
    .eq('is_enabled', true)
    .order('sort_order')
  const providers = (enabled ?? []) as ProviderRow[]
  if (!providers.length) return json({ error: 'Online donations are not available right now.' }, 503)

  const chosen = input.provider
    ? providers.find((p) => p.provider === input.provider)
    : providers.length === 1
      ? providers[0]
      : undefined
  if (!chosen) return json({ error: 'Please choose a payment method.' }, 400)

  const amountMinor = Math.round(input.amount * 100)
  const { data: tx, error: txErr } = await admin
    .rpc('donation_create_transaction', {
      _provider: chosen.provider,
      _amount_minor: amountMinor,
      _currency: 'NGN',
      _donor_name: input.name,
      _donor_email: input.email,
      _message: input.message ?? null,
      _is_anonymous: input.anonymous ?? false,
      _user: userId,
    })
    .single()
  if (txErr || !tx) {
    const code = Object.keys(FRIENDLY).find((k) => txErr?.message?.includes(k))
    if (!code) console.error('create donation failed', txErr)
    return json({ error: code ? FRIENDLY[code] : 'Could not start the donation. Please try again.' }, code ? 400 : 500)
  }

  const t = tx as { reference: string; amount_minor: number; currency: string }
  try {
    const result = await initializePayment(admin, chosen, {
      reference: t.reference,
      amountMinor: Number(t.amount_minor),
      currency: t.currency,
      email: input.email,
      customerName: input.name,
      description: 'Donation to AbiaConnect',
      // No query string: providers append their own reference parameter.
      callbackUrl: `${SITE_URL}/donate/callback`,
    })
    await admin.rpc('payment_attach_checkout', {
      _reference: t.reference,
      _provider_reference: result.providerReference,
      _checkout_url: result.checkoutUrl,
    })
    return json({ checkoutUrl: result.checkoutUrl, reference: t.reference })
  } catch (e) {
    console.error('donation initialize failed', e instanceof Error ? e.message : e)
    await admin
      .from('payment_transactions')
      .update({ status: 'failed', failure_reason: 'initialize_failed' })
      .eq('reference', t.reference)
      .eq('status', 'pending')
    await admin.from('donations').update({ status: 'rejected', admin_notes: 'Checkout could not start' }).eq('reference', t.reference).eq('status', 'pending')
    const msg = e instanceof ProviderError ? 'The payment provider is unavailable right now. Please try again.' : 'Could not start the donation.'
    return json({ error: msg }, 502)
  }
})
