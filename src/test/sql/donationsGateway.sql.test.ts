// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// Minimal copies of the live payment tables as they are before this migration.
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE public.payment_providers (provider text PRIMARY KEY, is_enabled boolean NOT NULL DEFAULT false,
    mode text NOT NULL DEFAULT 'test', sort_order int NOT NULL DEFAULT 0, display_name text);
  CREATE TABLE public.subscription_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, name text,
    duration_days int NOT NULL DEFAULT 30, price_minor bigint, currency text DEFAULT 'NGN');
  CREATE TABLE public.user_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, plan_id uuid,
    status text, source text, payment_id uuid, starts_at timestamptz, ends_at timestamptz, note text);
  CREATE TABLE public.donations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_name text NOT NULL, donor_email text,
    amount numeric(14,2) NOT NULL CHECK (amount > 0), currency text NOT NULL DEFAULT 'NGN', message text,
    is_anonymous boolean NOT NULL DEFAULT false, payment_method text NOT NULL DEFAULT 'bank_transfer', reference text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
    confirmed_by uuid, confirmed_at timestamptz, admin_notes text, created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    provider text NOT NULL, reference text NOT NULL UNIQUE, provider_reference text,
    purpose text NOT NULL DEFAULT 'subscription' CHECK (purpose IN ('subscription')),
    plan_id uuid REFERENCES public.subscription_plans(id), amount_minor bigint NOT NULL CHECK (amount_minor > 0),
    currency text NOT NULL, status text NOT NULL DEFAULT 'pending', checkout_url text, failure_reason text,
    mode text NOT NULL DEFAULT 'test', created_at timestamptz NOT NULL DEFAULT now(), verified_at timestamptz, refunded_at timestamptz);
  CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, message text, link text);
  CREATE TABLE public.monetization_events (id bigserial PRIMARY KEY, user_id uuid, event text, metadata jsonb);
  CREATE FUNCTION public.log_monetization_event(_uid uuid, _event text, _metadata jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE sql AS $$ INSERT INTO public.monetization_events (user_id, event, metadata) VALUES (_uid, _event, _metadata) $$;
  INSERT INTO public.payment_providers (provider, is_enabled, display_name) VALUES ('paystack', true, 'Paystack'), ('monnify', false, 'Monnify');
`

const MEMBER = '11111111-1111-1111-1111-111111111111'

describe('Donations through the payment gateway', () => {
  let db: PGlite
  const start = (amountMinor: number, opts: { provider?: string; email?: string; user?: string | null; currency?: string } = {}) =>
    db.query<{ reference: string; donation_id: string }>(
      `SELECT reference, donation_id FROM public.donation_create_transaction($1, $2, $3, 'Ada Obi', $4, 'For the community', false, $5)`,
      [opts.provider ?? 'paystack', amountMinor, opts.currency ?? 'NGN', opts.email ?? 'ada@example.com', opts.user ?? null],
    )
  const apply = (ref: string, status: string, paid: number | null, currency = 'NGN') =>
    db.query<{ r: string }>(`SELECT public.payment_apply_result('paystack', $1, $2, $3, $4, 'ps_1') AS r`, [ref, status, paid, currency])
  const donation = async (ref: string) =>
    (await db.query<{ status: string; amount: string; admin_notes: string | null }>(`SELECT status, amount::text, admin_notes FROM donations WHERE reference = $1`, [ref])).rows[0]

  beforeEach(async () => {
    db = await PGlite.create()
    await db.exec(PRELUDE)
    await db.query(`INSERT INTO auth.users VALUES ($1)`, [MEMBER])
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261006100000_donations_via_payment_gateway.sql'), 'utf8'))
  })

  it('starts a donation for a visitor: pending donation + payment, unguessable reference', async () => {
    const { reference } = (await start(500000)).rows[0]
    expect(reference).toMatch(/^ABIA[0-9A-F]{24}$/)
    expect(await donation(reference)).toMatchObject({ status: 'pending', amount: '5000.00' })
    const tx = (await db.query(`SELECT purpose, user_id, amount_minor::int AS a, status FROM payment_transactions WHERE reference = $1`, [reference])).rows[0]
    expect(tx).toEqual({ purpose: 'donation', user_id: null, a: 500000, status: 'pending' })
  })

  it('refuses invalid amounts, providers, currencies and emails', async () => {
    await expect(start(5000)).rejects.toThrow(/amount_invalid/) // NGN 50
    await expect(start(2_000_000_000)).rejects.toThrow(/amount_invalid/)
    await expect(start(500000, { provider: 'monnify' })).rejects.toThrow(/provider_unavailable/)
    await expect(start(500000, { currency: 'USD' })).rejects.toThrow(/currency_unsupported/)
    await expect(start(500000, { email: 'not-an-email' })).rejects.toThrow(/email_invalid/)
  })

  it('is server-only', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.query(`SET ROLE ${role}`)
      await expect(start(500000)).rejects.toThrow(/permission denied/)
      await db.query('RESET ROLE')
    }
  })

  it('confirms the donation when the provider verifies payment, once, and thanks a signed-in donor', async () => {
    const { reference } = (await start(1000000, { user: MEMBER })).rows[0]
    expect((await apply(reference, 'success', 1000000)).rows[0].r).toBe('fulfilled')
    expect(await donation(reference)).toMatchObject({ status: 'confirmed', admin_notes: 'Paid online via paystack' })
    expect((await apply(reference, 'success', 1000000)).rows[0].r).toBe('already_fulfilled')
    const n = (await db.query<{ message: string }>(`SELECT message FROM notifications WHERE user_id = $1`, [MEMBER])).rows
    expect(n).toHaveLength(1)
    expect(n[0].message).toContain('10,000.00')
  })

  it('never confirms a short or wrong-currency payment, and rejects failed ones', async () => {
    const short = (await start(1000000)).rows[0].reference
    expect((await apply(short, 'success', 500000)).rows[0].r).toBe('amount_mismatch')
    expect(await donation(short)).toMatchObject({ status: 'pending' })
    expect((await donation(short)).admin_notes).toMatch(/Amount mismatch/)
    const usd = (await start(1000000, { email: 'b@example.com' })).rows[0].reference
    expect((await apply(usd, 'success', 1000000, 'USD')).rows[0].r).toBe('amount_mismatch')
    const failed = (await start(1000000, { email: 'c@example.com' })).rows[0].reference
    expect((await apply(failed, 'failed', null)).rows[0].r).toBe('marked_failed')
    expect(await donation(failed)).toMatchObject({ status: 'rejected' })
  })

  it('un-confirms a refunded donation', async () => {
    const { reference } = (await start(300000)).rows[0]
    await apply(reference, 'success', 300000)
    expect((await db.query<{ r: string }>(`SELECT public.payment_apply_refund('paystack', $1) AS r`, [reference])).rows[0].r).toBe('refunded')
    expect(await donation(reference)).toMatchObject({ status: 'rejected', admin_notes: 'Refunded by provider' })
  })

  it('still grants premium for subscription payments', async () => {
    const plan = (await db.query<{ id: string }>(`INSERT INTO subscription_plans (code, name, price_minor) VALUES ('gold', 'Gold', 200000) RETURNING id`)).rows[0].id
    await db.query(`INSERT INTO payment_transactions (user_id, provider, reference, plan_id, amount_minor, currency) VALUES ($1, 'paystack', 'ABIASUB1', $2, 200000, 'NGN')`, [MEMBER, plan])
    expect((await apply('ABIASUB1', 'success', 200000)).rows[0].r).toBe('fulfilled')
    expect((await db.query(`SELECT status FROM user_subscriptions WHERE user_id = $1`, [MEMBER])).rows).toEqual([{ status: 'active' }])
  })

  it('no longer blocks deleting the account of someone who paid', async () => {
    const { reference } = (await start(300000, { user: MEMBER })).rows[0]
    await apply(reference, 'success', 300000)
    await db.query(`DELETE FROM auth.users WHERE id = $1`, [MEMBER])
    const tx = (await db.query(`SELECT user_id, status FROM payment_transactions WHERE reference = $1`, [reference])).rows[0]
    expect(tx).toEqual({ user_id: null, status: 'success' }) // record kept, unlinked
  })
})
