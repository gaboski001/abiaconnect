// Called by the payment callback page. Re-verifies the transaction with the
// provider server-side (in case the webhook is delayed) and applies the
// result through the same idempotent database function as the webhook.
// The client's claim of success is never trusted.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import type { Provider } from '../_shared/payment-core.ts'
import { verifyPayment, type Mode, loadPaymentSecrets } from '../_shared/payment-providers.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({ reference: z.string().regex(/^ABIA[0-9A-F]{24}$/) })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return json({ error: 'Invalid request' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE)
  await loadPaymentSecrets(admin)
  const load = () =>
    admin
      .from('payment_transactions')
      .select('reference, provider, mode, status, purpose, user_id, amount_minor, plan:subscription_plans(name)')
      .eq('reference', parsed.data.reference)
      .maybeSingle()

  let { data: tx } = await load()
  if (!tx) return json({ error: 'Payment not found' }, 404)

  // Premium payments: members can only check their own. Donations can be
  // checked by whoever holds the (unguessable) reference, including visitors.
  if (tx.purpose !== 'donation') {
    const auth = req.headers.get('Authorization')
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } })
    const { data: claims, error: claimErr } = await userClient.auth.getClaims(auth.replace('Bearer ', ''))
    const userId = claims?.claims?.sub
    if (claimErr || !userId) return json({ error: 'Unauthorized' }, 401)
    if (tx.user_id !== userId) return json({ error: 'Payment not found' }, 404)
  }

  if (tx.status === 'pending') {
    try {
      const v = await verifyPayment(admin, tx.provider as Provider, tx.mode as Mode, tx.reference)
      if (v.status !== 'pending') {
        await admin.rpc('payment_apply_result', {
          _provider: tx.provider,
          _reference: tx.reference,
          _status: v.status,
          _paid_minor: v.paidMinor,
          _currency: v.currency,
          _provider_reference: v.providerReference,
        })
        ;({ data: tx } = await load())
      }
    } catch (e) {
      // Provider unreachable: report "processing"; the webhook will finish it.
      console.error('verify failed', e instanceof Error ? e.message : e)
    }
  }

  const plan = (tx as { plan?: { name?: string } | null }).plan
  return json({
    status: tx!.status,
    purpose: tx!.purpose,
    planName: plan?.name ?? null,
    amountMinor: tx!.purpose === 'donation' ? tx!.amount_minor : undefined,
  })
})
