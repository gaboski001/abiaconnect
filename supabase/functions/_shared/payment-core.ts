// Provider-agnostic payment logic with no Deno/network dependencies, so it can
// be unit-tested. Behaviour follows each provider's official documentation:
//   Paystack  https://paystack.com/docs/payments/webhooks/  (x-paystack-signature, HMAC-SHA512 hex)
//   Monnify   https://developers.monnify.com/docs/webhooks  (monnify-signature, HMAC-SHA512 hex of body with client secret)
//   Squad     https://squadinc.gitbook.io/squad-api-documentation/webhook-and-redirect-url/signature-validation
//             (x-squad-encrypted-body, HMAC-SHA512 hex upper-case)

export type Provider = 'paystack' | 'monnify' | 'squad'
export const PROVIDERS: Provider[] = ['paystack', 'monnify', 'squad']

export type PaymentStatus = 'success' | 'failed' | 'abandoned' | 'pending'

export interface VerifyResult {
  status: PaymentStatus
  /** Amount actually paid, in minor units (kobo/cents). */
  paidMinor: number | null
  currency: string | null
  providerReference: string | null
}

export const SIGNATURE_HEADER: Record<Provider, string> = {
  paystack: 'x-paystack-signature',
  monnify: 'monnify-signature',
  squad: 'x-squad-encrypted-body',
}

export async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (x.length !== y.length || x.length === 0) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return diff === 0
}

/**
 * Verify a webhook signature over the RAW request body against any of the
 * configured secrets (test and live keys can both be set).
 */
export async function verifyWebhookSignature(
  provider: Provider,
  rawBody: string,
  signature: string | null,
  secrets: Array<string | undefined>,
): Promise<boolean> {
  if (!signature) return false
  for (const secret of secrets) {
    if (!secret) continue
    const expected = await hmacSha512Hex(secret, rawBody)
    if (timingSafeEqualHex(expected, signature)) return true
    // Squad's sample signs JSON.stringify(body); accept that canonical form too.
    if (provider === 'squad') {
      try {
        const canonical = JSON.stringify(JSON.parse(rawBody))
        if (canonical !== rawBody && timingSafeEqualHex(await hmacSha512Hex(secret, canonical), signature)) return true
      } catch {
        /* not JSON */
      }
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Verify-endpoint response mapping
// ---------------------------------------------------------------------------

/** Paystack GET /transaction/verify/:reference → data.status / data.amount (kobo) */
export function mapPaystackVerify(body: any): VerifyResult {
  const d = body?.data ?? {}
  const s = String(d.status ?? '').toLowerCase()
  const status: PaymentStatus =
    s === 'success' ? 'success' : s === 'failed' || s === 'reversed' ? 'failed' : s === 'abandoned' ? 'abandoned' : 'pending'
  return {
    status,
    paidMinor: Number.isFinite(Number(d.amount)) ? Math.round(Number(d.amount)) : null,
    currency: d.currency ? String(d.currency).toUpperCase() : null,
    providerReference: d.id != null ? String(d.id) : null,
  }
}

/** Monnify GET /api/v2/merchant/transactions/query → responseBody.paymentStatus / amountPaid (major units) */
export function mapMonnifyVerify(body: any): VerifyResult {
  const d = body?.responseBody ?? {}
  const s = String(d.paymentStatus ?? '').toUpperCase()
  const status: PaymentStatus =
    s === 'PAID' || s === 'OVERPAID'
      ? 'success'
      : // A partial payment is reported as success with the smaller amount; the
        // database refuses to grant access when the amount is short.
        s === 'PARTIALLY_PAID'
        ? 'success'
        : s === 'FAILED' || s === 'REVERSED'
          ? 'failed'
          : s === 'EXPIRED' || s === 'ABANDONED' || s === 'CANCELLED'
            ? 'abandoned'
            : 'pending'
  const paid = Number(d.amountPaid)
  return {
    status,
    paidMinor: Number.isFinite(paid) ? Math.round(paid * 100) : null,
    currency: d.currencyCode ? String(d.currencyCode).toUpperCase() : null,
    providerReference: d.transactionReference ? String(d.transactionReference) : null,
  }
}

/** Squad GET /transaction/verify/{ref} → data.transaction_status / transaction_amount (kobo) */
export function mapSquadVerify(body: any): VerifyResult {
  const d = body?.data ?? {}
  const s = String(d.transaction_status ?? '').toLowerCase()
  const status: PaymentStatus =
    s === 'success' ? 'success' : s === 'failed' ? 'failed' : s === 'abandoned' || s === 'cancelled' ? 'abandoned' : 'pending'
  const amount = Number(d.transaction_amount)
  return {
    status,
    paidMinor: Number.isFinite(amount) ? Math.round(amount) : null,
    currency: d.transaction_currency_id ? String(d.transaction_currency_id).toUpperCase() : null,
    providerReference: d.gateway_transaction_ref ? String(d.gateway_transaction_ref) : null,
  }
}

// ---------------------------------------------------------------------------
// Webhook payload parsing
// ---------------------------------------------------------------------------

export interface ParsedWebhook {
  /** Unique per provider event; used to drop duplicate deliveries. */
  eventKey: string
  eventType: string
  kind: 'payment_success' | 'refund' | 'other'
  /** Our reference (payments) or the provider's transaction reference (refunds). */
  reference: string | null
}

export function parseWebhook(provider: Provider, body: any): ParsedWebhook {
  if (provider === 'paystack') {
    const type = String(body?.event ?? 'unknown')
    const d = body?.data ?? {}
    if (type === 'charge.success') {
      return { eventKey: `${type}:${d.id ?? d.reference}`, eventType: type, kind: 'payment_success', reference: d.reference ?? null }
    }
    if (type === 'refund.processed') {
      const ref = d.transaction_reference ?? d.transaction?.reference ?? null
      return { eventKey: `${type}:${d.id ?? ref}`, eventType: type, kind: 'refund', reference: ref }
    }
    return { eventKey: `${type}:${d.id ?? d.reference ?? JSON.stringify(d).length}`, eventType: type, kind: 'other', reference: d.reference ?? null }
  }

  if (provider === 'monnify') {
    const type = String(body?.eventType ?? 'unknown')
    const d = body?.eventData ?? {}
    if (type === 'SUCCESSFUL_TRANSACTION') {
      return {
        eventKey: `${type}:${d.transactionReference ?? d.paymentReference}`,
        eventType: type,
        kind: 'payment_success',
        reference: d.paymentReference ?? null,
      }
    }
    if (type === 'SUCCESSFUL_REFUND') {
      return {
        eventKey: `${type}:${d.refundReference ?? d.transactionReference}`,
        eventType: type,
        kind: 'refund',
        reference: d.transactionReference ?? null,
      }
    }
    return { eventKey: `${type}:${d.transactionReference ?? d.reference ?? 'n/a'}`, eventType: type, kind: 'other', reference: null }
  }

  // squad
  const type = String(body?.Event ?? 'unknown')
  const d = body?.Body ?? {}
  const ref = body?.TransactionRef ?? d.transaction_ref ?? null
  if (type === 'charge_successful') {
    return { eventKey: `${type}:${ref}:${d.gateway_ref ?? ''}`, eventType: type, kind: 'payment_success', reference: ref }
  }
  return { eventKey: `${type}:${ref ?? 'n/a'}`, eventType: type, kind: 'other', reference: ref }
}

// ---------------------------------------------------------------------------
// Log redaction: never store keys, tokens, card or bank details.
// ---------------------------------------------------------------------------
const SENSITIVE_PART = /authorization|token|secret|api_?key|password|signature|account_?number|card|bank_?code|exp_(month|year)/i
const SENSITIVE_EXACT = new Set(['pan', 'bin', 'last4', 'cvv', 'bvn', 'pin', 'otp'])

const isSensitiveKey = (k: string) => SENSITIVE_PART.test(k) || SENSITIVE_EXACT.has(k.toLowerCase())

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '…'
  return value
}
