// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  hmacSha512Hex,
  mapMonnifyVerify,
  mapPaystackVerify,
  mapSquadVerify,
  parseWebhook,
  redact,
  verifyWebhookSignature,
} from '../../supabase/functions/_shared/payment-core'

describe('webhook signatures (HMAC-SHA512 over the raw body)', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { id: 1, reference: 'ABIA00' } })

  it('accepts a valid Paystack/Monnify signature and rejects tampering or wrong keys', async () => {
    const sig = await hmacSha512Hex('sk_test_secret', body)
    expect(await verifyWebhookSignature('paystack', body, sig, ['sk_test_secret'])).toBe(true)
    expect(await verifyWebhookSignature('monnify', body, sig, [undefined, 'sk_test_secret'])).toBe(true)
    expect(await verifyWebhookSignature('paystack', body + ' ', sig, ['sk_test_secret'])).toBe(false)
    expect(await verifyWebhookSignature('paystack', body, sig, ['another_key'])).toBe(false)
    expect(await verifyWebhookSignature('paystack', body, null, ['sk_test_secret'])).toBe(false)
    expect(await verifyWebhookSignature('paystack', body, sig, [])).toBe(false)
  })

  it('accepts Squad upper-case signatures, including over the canonical JSON form', async () => {
    const pretty = '{\n  "Event": "charge_successful",\n  "TransactionRef": "ABIA01"\n}'
    const canonicalSig = (await hmacSha512Hex('sq_key', JSON.stringify(JSON.parse(pretty)))).toUpperCase()
    expect(await verifyWebhookSignature('squad', pretty, canonicalSig, ['sq_key'])).toBe(true)
    const rawSig = (await hmacSha512Hex('sq_key', pretty)).toUpperCase()
    expect(await verifyWebhookSignature('squad', pretty, rawSig, ['sq_key'])).toBe(true)
  })
})

describe('verify response mapping (sample payloads from provider docs)', () => {
  it('Paystack: success / abandoned / unknown', () => {
    expect(mapPaystackVerify({ status: true, data: { id: 4099260516, status: 'success', amount: 40333, currency: 'NGN' } })).toEqual({
      status: 'success',
      paidMinor: 40333,
      currency: 'NGN',
      providerReference: '4099260516',
    })
    expect(mapPaystackVerify({ data: { status: 'abandoned' } }).status).toBe('abandoned')
    expect(mapPaystackVerify({ data: { status: 'ongoing' } }).status).toBe('pending')
  })

  it('Monnify: converts naira to kobo and maps statuses', () => {
    const r = mapMonnifyVerify({
      requestSuccessful: true,
      responseBody: { transactionReference: 'MNFY|67|20240601|000023', amountPaid: 10000, paymentStatus: 'PAID', currencyCode: 'NGN' },
    })
    expect(r).toEqual({ status: 'success', paidMinor: 1000000, currency: 'NGN', providerReference: 'MNFY|67|20240601|000023' })
    expect(mapMonnifyVerify({ responseBody: { paymentStatus: 'EXPIRED' } }).status).toBe('abandoned')
    expect(mapMonnifyVerify({ responseBody: { paymentStatus: 'PENDING' } }).status).toBe('pending')
    // Partial payments are passed on with the short amount; the DB refuses them.
    expect(mapMonnifyVerify({ responseBody: { paymentStatus: 'PARTIALLY_PAID', amountPaid: 50.5 } }).paidMinor).toBe(5050)
  })

  it('Squad: case-insensitive status, amount already in kobo', () => {
    expect(
      mapSquadVerify({
        success: true,
        data: { transaction_amount: 5000, transaction_status: 'Success', transaction_currency_id: 'NGN', gateway_transaction_ref: 'SQ1' },
      }),
    ).toEqual({ status: 'success', paidMinor: 5000, currency: 'NGN', providerReference: 'SQ1' })
    expect(mapSquadVerify({ data: { transaction_status: 'failed' } }).status).toBe('failed')
  })
})

describe('webhook parsing', () => {
  it('extracts our reference and a stable dedupe key per provider', () => {
    expect(parseWebhook('paystack', { event: 'charge.success', data: { id: 9, reference: 'ABIAX' } })).toMatchObject({
      kind: 'payment_success',
      reference: 'ABIAX',
      eventKey: 'charge.success:9',
    })
    expect(parseWebhook('paystack', { event: 'refund.processed', data: { id: 3, transaction_reference: 'ABIAX' } })).toMatchObject({
      kind: 'refund',
      reference: 'ABIAX',
    })
    expect(
      parseWebhook('monnify', {
        eventType: 'SUCCESSFUL_TRANSACTION',
        eventData: { transactionReference: 'MNFY|1', paymentReference: 'ABIAY' },
      }),
    ).toMatchObject({ kind: 'payment_success', reference: 'ABIAY', eventKey: 'SUCCESSFUL_TRANSACTION:MNFY|1' })
    expect(
      parseWebhook('monnify', { eventType: 'SUCCESSFUL_REFUND', eventData: { transactionReference: 'MNFY|1', refundReference: 'R1' } }),
    ).toMatchObject({ kind: 'refund', reference: 'MNFY|1' })
    expect(
      parseWebhook('squad', { Event: 'charge_successful', TransactionRef: 'ABIAZ', Body: { gateway_ref: 'ABIAZ_1_1' } }),
    ).toMatchObject({ kind: 'payment_success', reference: 'ABIAZ' })
    expect(parseWebhook('paystack', { event: 'transfer.success', data: { id: 1 } }).kind).toBe('other')
  })
})

describe('log redaction', () => {
  it('removes keys, tokens and card/bank details but keeps useful fields', () => {
    const out = redact({
      headers: { Authorization: 'Bearer sk_live_x' },
      data: {
        reference: 'ABIA1',
        company: 'Acme',
        authorization: { authorization_code: 'AUTH_x', last4: '4081', bin: '408408' },
        payment_information: { pan: '408408******4081', token_id: 'tok' },
        accountNumber: '0123456789',
      },
    }) as {
      headers: Record<string, unknown>
      data: Record<string, unknown>
    }
    expect(out.headers.Authorization).toBe('[redacted]')
    expect(out.data.authorization).toBe('[redacted]')
    expect(out.data.payment_information).toEqual({ pan: '[redacted]', token_id: '[redacted]' })
    expect(out.data.accountNumber).toBe('[redacted]')
    expect(out.data.reference).toBe('ABIA1')
    expect(out.data.company).toBe('Acme')
  })
})
