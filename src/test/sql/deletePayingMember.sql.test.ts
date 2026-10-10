// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMonetizationDb } from './monetizationHarness'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })

const migration = (f: string) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8')

describe('Deleting the account of a member who has paid', () => {
  it('removes the account and keeps the payment record, unlinked', async () => {
    const db = await createMonetizationDb()
    await db.exec(`CREATE TABLE IF NOT EXISTS public.donations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_name text NOT NULL, donor_email text,
      amount numeric(14,2) NOT NULL, currency text NOT NULL DEFAULT 'NGN', message text, is_anonymous boolean NOT NULL DEFAULT false,
      payment_method text NOT NULL DEFAULT 'bank_transfer', reference text, status text NOT NULL DEFAULT 'pending',
      confirmed_by uuid, confirmed_at timestamptz, admin_notes text, created_by uuid, created_at timestamptz NOT NULL DEFAULT now())`)
    await db.exec(migration('20261006100000_donations_via_payment_gateway.sql'))
    await db.exec(migration('20261008090000_allow_deleting_donations.sql'))

    const member = await db.addUser()
    await db.query(`UPDATE payment_providers SET is_enabled = true WHERE provider = 'paystack'`)
    const plan = await db.one<{ id: string; price_minor: string; currency: string }>(
      `SELECT id, price_minor::text, currency FROM subscription_plans WHERE code = 'premium_monthly'`,
    )
    await db.query(
      `INSERT INTO payment_transactions (user_id, provider, reference, plan_id, amount_minor, currency, mode) VALUES ($1, 'paystack', 'REF1', $2, $3, $4, 'test')`,
      [member, plan.id, plan.price_minor, plan.currency],
    )
    const applied = await db.one<{ r: string }>(`SELECT public.payment_apply_result('paystack', 'REF1', 'success', $1, $2, 'ps_1') AS r`, [plan.price_minor, plan.currency])
    expect(applied.r).toBe('fulfilled')

    await db.query(`DELETE FROM auth.users WHERE id = $1`, [member])
    expect((await db.query(`SELECT user_id, status FROM payment_transactions WHERE reference = 'REF1'`)).rows).toEqual([{ user_id: null, status: 'success' }])
    expect((await db.query(`SELECT 1 FROM user_subscriptions WHERE user_id = $1`, [member])).rows).toEqual([])
  })
})
