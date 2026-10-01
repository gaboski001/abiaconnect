// Payment webhooks for Paystack, Monnify and Squad.
//   https://<project>.supabase.co/functions/v1/payments-webhook?provider=paystack
//   https://<project>.supabase.co/functions/v1/payments-webhook?provider=monnify
//   https://<project>.supabase.co/functions/v1/payments-webhook?provider=squad
//
// 1. Verify the provider's HMAC-SHA512 signature over the raw body.
// 2. Store the event once (unique provider + event key) — duplicates are acked.
// 3. Re-verify the payment with the provider's API before granting anything.
// 4. Apply through the idempotent payment_apply_result / payment_apply_refund.
// Deployed with verify_jwt = false: providers don't send Supabase JWTs; the
// signature check is the authentication.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  parseWebhook,
  PROVIDERS,
  redact,
  SIGNATURE_HEADER,
  verifyWebhookSignature,
  type Provider,
} from '../_shared/payment-core.ts'
import { verifyPayment, webhookSecrets, type Mode } from '../_shared/payment-providers.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const reply = (status: number, body: Record<string, unknown> = { ok: status < 300 }) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })
  const provider = new URL(req.url).searchParams.get('provider') as Provider | null
  if (!provider || !PROVIDERS.includes(provider)) return reply(400, { error: 'Unknown provider' })

  const admin = createClient(SUPABASE_URL, SERVICE)
  const rawBody = await req.text()
  const signature = req.headers.get(SIGNATURE_HEADER[provider])

  const valid = await verifyWebhookSignature(provider, rawBody, signature, webhookSecrets(provider))
  if (!valid) {
    await admin.from('payment_provider_logs').insert({
      provider,
      action: 'webhook',
      ok: false,
      http_status: 401,
      error: signature ? 'invalid signature' : 'missing signature',
      request: { bytes: rawBody.length },
    })
    return reply(401, { error: 'Invalid signature' })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return reply(400, { error: 'Invalid JSON' })
  }
  const event = parseWebhook(provider, body)

  // Record once. A repeat delivery of an already-processed event is acked.
  const { data: inserted, error: insErr } = await admin
    .from('payment_webhook_events')
    .upsert(
      {
        provider,
        event_key: event.eventKey,
        event_type: event.eventType,
        reference: event.reference,
        signature_valid: true,
        payload: redact(body),
      },
      { onConflict: 'provider,event_key', ignoreDuplicates: true },
    )
    .select('id')
  if (insErr) {
    console.error('webhook event insert failed', insErr.message)
    return reply(500, { error: 'Storage error' }) // provider will retry
  }
  if (!inserted?.length) {
    const { data: prior } = await admin
      .from('payment_webhook_events')
      .select('id, processed_at')
      .eq('provider', provider)
      .eq('event_key', event.eventKey)
      .maybeSingle()
    if (prior?.processed_at) return reply(200, { ok: true, duplicate: true })
  }

  let result = 'ignored'
  try {
    if (event.kind === 'payment_success' && event.reference) {
      const { data: tx } = await admin
        .from('payment_transactions')
        .select('reference, mode')
        .eq('provider', provider)
        .eq('reference', event.reference)
        .maybeSingle()
      if (!tx) {
        result = 'unknown_reference'
      } else {
        // Never trust the webhook body alone: confirm with the provider API.
        const v = await verifyPayment(admin, provider, tx.mode as Mode, tx.reference)
        if (v.status === 'pending') {
          result = 'still_pending'
        } else {
          const { data } = await admin.rpc('payment_apply_result', {
            _provider: provider,
            _reference: tx.reference,
            _status: v.status,
            _paid_minor: v.paidMinor,
            _currency: v.currency,
            _provider_reference: v.providerReference,
          })
          result = String(data)
        }
      }
    } else if (event.kind === 'refund' && event.reference) {
      const { data } = await admin.rpc('payment_apply_refund', { _provider: provider, _ref: event.reference })
      result = String(data)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('webhook processing failed', msg)
    await admin
      .from('payment_webhook_events')
      .update({ process_result: `error: ${msg}`.slice(0, 300) })
      .eq('provider', provider)
      .eq('event_key', event.eventKey)
    return reply(500, { error: 'Processing error' }) // retried by the provider
  }

  await admin
    .from('payment_webhook_events')
    .update({ processed_at: new Date().toISOString(), process_result: result })
    .eq('provider', provider)
    .eq('event_key', event.eventKey)
  await admin.from('payment_provider_logs').insert({
    provider,
    action: 'webhook',
    reference: event.reference,
    ok: true,
    http_status: 200,
    request: { event: event.eventType },
    response: { result },
  })
  return reply(200, { ok: true })
})
