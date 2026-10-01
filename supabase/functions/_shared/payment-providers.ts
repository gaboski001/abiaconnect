// Provider adapters (initialize + verify) for Paystack, Monnify and Squad.
// Endpoints/fields follow each provider's official documentation; every call
// is written (redacted) to public.payment_provider_logs.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  mapMonnifyVerify,
  mapPaystackVerify,
  mapSquadVerify,
  redact,
  type Provider,
  type VerifyResult,
} from './payment-core.ts'

export type Mode = 'test' | 'live'

export interface ProviderRow {
  provider: Provider
  is_enabled: boolean
  mode: Mode
  contract_code: string | null
}

export interface InitInput {
  reference: string
  amountMinor: number
  currency: string
  email: string
  customerName: string
  description: string
  callbackUrl: string
}

export interface InitResult {
  checkoutUrl: string
  providerReference: string | null
}

// Keys saved from the admin dashboard live encrypted in Supabase Vault and
// are read through get_payment_secrets() (service role only). Function
// secrets set in the hosting dashboard still work as a fallback.
const dbSecrets = new Map<string, string>()
let secretsLoadedAt = 0
const SECRETS_TTL_MS = 15_000

/** Load admin-managed keys; call once at the start of every payment function. */
export async function loadPaymentSecrets(admin: SupabaseClient, opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force && Date.now() - secretsLoadedAt < SECRETS_TTL_MS) return
  const { data, error } = await admin.rpc('get_payment_secrets')
  if (error) {
    console.error('could not load payment secrets', error.message)
    return // keep previous values; env fallback still applies
  }
  dbSecrets.clear()
  for (const row of (data ?? []) as Array<{ name: string; value: string }>) {
    if (row.value) dbSecrets.set(row.name, row.value)
  }
  secretsLoadedAt = Date.now()
}

const env = (name: string) => dbSecrets.get(name) || Deno.env.get(name) || undefined

/** Secret names per provider and mode (set them as Supabase function secrets). */
export const SECRET_NAMES: Record<Provider, Record<Mode, string[]>> = {
  paystack: { test: ['PAYSTACK_TEST_SECRET_KEY'], live: ['PAYSTACK_LIVE_SECRET_KEY'] },
  monnify: {
    test: ['MONNIFY_TEST_API_KEY', 'MONNIFY_TEST_SECRET_KEY'],
    live: ['MONNIFY_LIVE_API_KEY', 'MONNIFY_LIVE_SECRET_KEY'],
  },
  squad: { test: ['SQUAD_TEST_SECRET_KEY'], live: ['SQUAD_LIVE_SECRET_KEY'] },
}

export const isConfigured = (provider: Provider, mode: Mode) => SECRET_NAMES[provider][mode].every((n) => !!env(n))

/** Secrets used to sign webhooks (both modes, so in-flight test events still verify). */
export function webhookSecrets(provider: Provider): Array<string | undefined> {
  if (provider === 'paystack') return [env('PAYSTACK_LIVE_SECRET_KEY'), env('PAYSTACK_TEST_SECRET_KEY')]
  if (provider === 'monnify') return [env('MONNIFY_LIVE_SECRET_KEY'), env('MONNIFY_TEST_SECRET_KEY')]
  return [env('SQUAD_LIVE_SECRET_KEY'), env('SQUAD_TEST_SECRET_KEY')]
}

const BASE: Record<Provider, Record<Mode, string>> = {
  paystack: { test: 'https://api.paystack.co', live: 'https://api.paystack.co' },
  monnify: { test: 'https://sandbox.monnify.com', live: 'https://api.monnify.com' },
  squad: { test: 'https://sandbox-api-d.squadco.com', live: 'https://api-d.squadco.com' },
}

export class ProviderError extends Error {}

/** fetch() + timing + redacted log row. */
async function call(
  admin: SupabaseClient,
  provider: Provider,
  action: string,
  reference: string | null,
  url: string,
  init: RequestInit & { logBody?: unknown },
): Promise<{ status: number; body: any }> {
  const started = Date.now()
  let status = 0
  let body: any = null
  let error: string | null = null
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
    status = res.status
    const text = await res.text()
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { raw: text.slice(0, 500) }
    }
    return { status, body }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    throw new ProviderError(`${provider} ${action} request failed`)
  } finally {
    const ok = !error && status >= 200 && status < 300
    await admin
      .from('payment_provider_logs')
      .insert({
        provider,
        action,
        reference,
        http_status: status || null,
        ok,
        duration_ms: Date.now() - started,
        request: redact({ method: init.method ?? 'GET', url: url.replace(/\?.*/, ''), body: init.logBody ?? null }),
        response: redact(body),
        error,
      })
      .then(({ error: logErr }) => logErr && console.error('provider log insert failed', logErr.message))
  }
}

// ---------------------------------------------------------------------------
// Monnify access token (Basic apiKey:secretKey → Bearer, valid ~1 hour)
// ---------------------------------------------------------------------------
const monnifyTokens = new Map<Mode, { token: string; expiresAt: number }>()

async function monnifyToken(admin: SupabaseClient, mode: Mode): Promise<string> {
  const cached = monnifyTokens.get(mode)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const prefix = mode === 'live' ? 'MONNIFY_LIVE' : 'MONNIFY_TEST'
  const apiKey = env(`${prefix}_API_KEY`)
  const secret = env(`${prefix}_SECRET_KEY`)
  if (!apiKey || !secret) throw new ProviderError('Monnify is not configured')
  const { status, body } = await call(admin, 'monnify', 'auth', null, `${BASE.monnify[mode]}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${apiKey}:${secret}`)}`, 'Content-Type': 'application/json' },
  })
  const token = body?.responseBody?.accessToken
  if (status !== 200 || !body?.requestSuccessful || !token) throw new ProviderError('Monnify authentication failed')
  const ttl = Number(body?.responseBody?.expiresIn) || 3000
  monnifyTokens.set(mode, { token, expiresAt: Date.now() + ttl * 1000 })
  return token
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
export async function initializePayment(admin: SupabaseClient, cfg: ProviderRow, input: InitInput): Promise<InitResult> {
  const { provider, mode } = cfg
  if (!isConfigured(provider, mode)) throw new ProviderError(`${provider} (${mode}) is not configured`)

  if (provider === 'paystack') {
    const payload = {
      email: input.email,
      amount: String(input.amountMinor), // subunit (kobo/cents)
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify({ reference: input.reference, purpose: 'dating_subscription' }),
    }
    const { status, body } = await call(admin, provider, 'initialize', input.reference, `${BASE.paystack[mode]}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env(mode === 'live' ? 'PAYSTACK_LIVE_SECRET_KEY' : 'PAYSTACK_TEST_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      logBody: payload,
    })
    const url = body?.data?.authorization_url
    if (status !== 200 || !body?.status || !url) throw new ProviderError('Paystack could not start the payment')
    return { checkoutUrl: url, providerReference: null }
  }

  if (provider === 'monnify') {
    if (!cfg.contract_code) throw new ProviderError('Monnify contract code is not set')
    const token = await monnifyToken(admin, mode)
    const payload = {
      amount: input.amountMinor / 100, // Monnify uses major units (naira)
      customerName: input.customerName,
      customerEmail: input.email,
      paymentReference: input.reference,
      paymentDescription: input.description,
      currencyCode: input.currency,
      contractCode: cfg.contract_code,
      redirectUrl: input.callbackUrl,
      paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
      metaData: { reference: input.reference },
    }
    const { status, body } = await call(
      admin,
      provider,
      'initialize',
      input.reference,
      `${BASE.monnify[mode]}/api/v1/merchant/transactions/init-transaction`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        logBody: payload,
      },
    )
    const rb = body?.responseBody
    if (status !== 200 || !body?.requestSuccessful || !rb?.checkoutUrl) throw new ProviderError('Monnify could not start the payment')
    // Monnify advises confirming the echoed values match what we sent.
    if (rb.paymentReference && rb.paymentReference !== input.reference) throw new ProviderError('Monnify reference mismatch')
    return { checkoutUrl: rb.checkoutUrl, providerReference: rb.transactionReference ?? null }
  }

  // squad
  const payload = {
    amount: input.amountMinor, // kobo/cents
    email: input.email,
    currency: input.currency,
    initiate_type: 'inline',
    transaction_ref: input.reference,
    callback_url: input.callbackUrl,
    customer_name: input.customerName,
    payment_channels: ['card', 'bank', 'ussd', 'transfer'],
    metadata: { reference: input.reference },
  }
  const { status, body } = await call(admin, provider, 'initialize', input.reference, `${BASE.squad[mode]}/transaction/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env(mode === 'live' ? 'SQUAD_LIVE_SECRET_KEY' : 'SQUAD_TEST_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    logBody: payload,
  })
  const url = body?.data?.checkout_url
  if (status !== 200 || !url) throw new ProviderError('Squad could not start the payment')
  return { checkoutUrl: url, providerReference: null }
}

// ---------------------------------------------------------------------------
// Verify (server-side; the only source of truth for granting access)
// ---------------------------------------------------------------------------
export async function verifyPayment(admin: SupabaseClient, provider: Provider, mode: Mode, reference: string): Promise<VerifyResult> {
  if (!isConfigured(provider, mode)) throw new ProviderError(`${provider} (${mode}) is not configured`)
  const ref = encodeURIComponent(reference)

  if (provider === 'paystack') {
    const { status, body } = await call(admin, provider, 'verify', reference, `${BASE.paystack[mode]}/transaction/verify/${ref}`, {
      headers: { Authorization: `Bearer ${env(mode === 'live' ? 'PAYSTACK_LIVE_SECRET_KEY' : 'PAYSTACK_TEST_SECRET_KEY')}` },
    })
    if (status !== 200 || !body?.status) return { status: 'pending', paidMinor: null, currency: null, providerReference: null }
    return mapPaystackVerify(body)
  }

  if (provider === 'monnify') {
    const token = await monnifyToken(admin, mode)
    const { status, body } = await call(
      admin,
      provider,
      'verify',
      reference,
      `${BASE.monnify[mode]}/api/v2/merchant/transactions/query?paymentReference=${ref}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (status !== 200 || !body?.requestSuccessful) return { status: 'pending', paidMinor: null, currency: null, providerReference: null }
    return mapMonnifyVerify(body)
  }

  const { status, body } = await call(admin, provider, 'verify', reference, `${BASE.squad[mode]}/transaction/verify/${ref}`, {
    headers: { Authorization: `Bearer ${env(mode === 'live' ? 'SQUAD_LIVE_SECRET_KEY' : 'SQUAD_TEST_SECRET_KEY')}` },
  })
  if (status !== 200 || !body?.success) return { status: 'pending', paidMinor: null, currency: null, providerReference: null }
  return mapSquadVerify(body)
}
