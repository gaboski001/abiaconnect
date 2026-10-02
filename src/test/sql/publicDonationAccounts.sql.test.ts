// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

// The live table after 20260619075931: signed-in members only, anon revoked.
const PRELUDE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  CREATE TABLE public.donation_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_type text NOT NULL, account_name text NOT NULL,
    account_number text, bank_name text, crypto_currency text, crypto_network text, wallet_address text,
    description text, is_active boolean NOT NULL DEFAULT true, order_index integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  GRANT SELECT ON public.donation_accounts TO authenticated;
  ALTER TABLE public.donation_accounts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated can view active donation accounts" ON public.donation_accounts
    FOR SELECT TO authenticated USING (is_active = true);
  INSERT INTO public.donation_accounts (account_type, account_name, account_number, bank_name, order_index, is_active) VALUES
    ('bank', 'AbiaConnect Foundation', '0123456789', 'Access Bank', 2, true),
    ('crypto', 'AbiaConnect USDT', NULL, NULL, 1, true),
    ('bank', 'Old account (draft)', '9999999999', 'Old Bank', 0, false);
`

describe('public donate page', () => {
  it('shows signed-out visitors the active donation accounts, in order, without opening the table', async () => {
    const db = await PGlite.create()
    await db.exec(PRELUDE)
    await db.exec(readFileSync(resolve(__dirname, '../../../supabase/migrations/20261002190000_public_donation_accounts.sql'), 'utf8'))
    await db.query('SET ROLE anon')
    const rows = (await db.query<{ account_name: string }>(`SELECT * FROM public.get_active_donation_accounts()`)).rows
    expect(rows.map((r) => r.account_name)).toEqual(['AbiaConnect USDT', 'AbiaConnect Foundation'])
    expect(Object.keys(rows[0])).not.toContain('is_active')
    expect(Object.keys(rows[0])).not.toContain('created_at')
    await expect(db.query(`SELECT * FROM public.donation_accounts`)).rejects.toThrow(/permission denied/)
    await db.query('RESET ROLE')
  })
})
