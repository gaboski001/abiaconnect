// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createMonetizationDb, type Db } from './monetizationHarness'

// Runs the real monetization migration on an in-process Postgres (PGlite).
let db: Db

beforeAll(async () => {
  db = await createMonetizationDb()
}, 60_000)

const react = async (as: string, target: string, kind: 'like' | 'pass') => {
  await db.as(as)
  const r = await db.one<{ r: Record<string, unknown> }>(`SELECT public.dating_react($1, $2) AS r`, [target, kind])
  return r.r
}

async function setFreeDailyLikes(n: number) {
  await db.as(null)
  await db.query(`UPDATE public.subscription_plans SET limits = limits || jsonb_build_object('daily_likes', $1::int) WHERE code = 'free'`, [n])
}

async function enableCheckout() {
  await db.as(null)
  await db.query(`UPDATE public.payment_providers SET is_enabled = true WHERE provider = 'paystack'`)
  await db.query(`UPDATE public.subscription_plans SET is_active = true WHERE code = 'premium_monthly'`)
  const { id } = await db.one<{ id: string }>(`SELECT id FROM public.subscription_plans WHERE code = 'premium_monthly'`)
  return id
}

async function createTx(user: string, planId: string) {
  await db.as(null)
  return db.one<{ reference: string; amount_minor: string; currency: string; status: string }>(
    `SELECT * FROM public.payment_create_transaction($1, $2, 'paystack')`,
    [user, planId],
  )
}

async function apply(ref: string, status: string, paid: number | string, currency = 'NGN') {
  await db.as(null)
  const r = await db.one<{ r: string }>(`SELECT public.payment_apply_result('paystack', $1, $2, $3, $4, 'PS-' || $1) AS r`, [
    ref,
    status,
    paid,
    currency,
  ])
  return r.r
}

async function entitlements(user: string) {
  await db.as(user)
  const r = await db.one<{ e: { tier: string; is_premium: boolean; limits: Record<string, unknown> } }>(
    `SELECT public.get_my_dating_entitlements() AS e`,
  )
  return r.e
}

describe('likes, limits and matches', () => {
  beforeEach(() => setFreeDailyLikes(3))

  it('enforces the free daily like limit server-side and does not re-charge repeat likes', async () => {
    const me = await db.addUser()
    const targets = await Promise.all([1, 2, 3, 4].map(() => db.addUser()))
    expect((await react(me, targets[0], 'like')).status).toBe('ok')
    expect((await react(me, targets[1], 'like')).status).toBe('ok')
    const third = await react(me, targets[2], 'like')
    expect(third).toMatchObject({ status: 'ok', likes_remaining: 0 })
    expect((await react(me, targets[3], 'like')).status).toBe('limit_reached')
    // Liking someone already liked costs nothing; passing is always free.
    expect((await react(me, targets[0], 'like')).status).toBe('ok')
    expect((await react(me, targets[3], 'pass')).status).toBe('ok')
  })

  it('creates a match (once) with notifications when likes are mutual', async () => {
    const a = await db.addUser()
    const b = await db.addUser()
    expect(await react(a, b, 'like')).toMatchObject({ status: 'ok', matched: false })
    expect(await react(b, a, 'like')).toMatchObject({ status: 'ok', matched: true })
    await db.as(null)
    const { n } = await db.one<{ n: number }>(
      `SELECT count(*)::int n FROM public.dating_matches WHERE $1 IN (user_low, user_high) AND $2 IN (user_low, user_high)`,
      [a, b],
    )
    expect(n).toBe(1)
    const notes = await db.query(`SELECT user_id FROM public.notifications WHERE type = 'dating_match' AND user_id IN ($1, $2)`, [a, b])
    expect(notes.rows).toHaveLength(2)
  })

  it('refuses blocked, banned and profile-less users', async () => {
    const me = await db.addUser()
    const blocker = await db.addUser()
    await db.as(null)
    await db.query(`INSERT INTO public.relationship_blocks VALUES ($1, $2)`, [blocker, me])
    expect((await react(me, blocker, 'like')).status).toBe('unavailable')

    const banned = await db.addUser({ banned: true })
    expect((await react(banned, me, 'like')).status).toBe('account_restricted')
    expect((await react(me, banned, 'like')).status).toBe('unavailable')

    const noProfile = await db.addUser({ dating: false })
    expect((await react(noProfile, me, 'like')).status).toBe('profile_required')
  })

  it('hides who liked you from free users but shows them to premium users', async () => {
    const me = await db.addUser()
    const fan = await db.addUser()
    await react(fan, me, 'like')

    await db.as(me)
    const free = (await db.one<{ r: Record<string, unknown> }>(`SELECT public.dating_likes_received() AS r`)).r
    expect(free).toMatchObject({ entitled: false, total: 1, preview_count: 1, items: [] })

    const planId = await enableCheckout()
    const tx = await createTx(me, planId)
    expect(await apply(tx.reference, 'success', tx.amount_minor)).toBe('fulfilled')

    await db.as(me)
    const premium = (await db.one<{ r: { entitled: boolean; items: Array<{ user_id: string }> } }>(
      `SELECT public.dating_likes_received() AS r`,
    )).r
    expect(premium.entitled).toBe(true)
    expect(premium.items.map((i) => i.user_id)).toEqual([fan])
  })

  it('never lets clients write likes or matches directly', async () => {
    const me = await db.addUser()
    const other = await db.addUser()
    await db.as(me)
    await db.asRole('authenticated', () =>
      expect(
        db.query(`INSERT INTO public.dating_likes (liker_id, liked_id, kind) VALUES ($1, $2, 'like')`, [me, other]),
      ).rejects.toThrow(/permission denied/),
    )
  })
})

describe('payments and entitlements', () => {
  it('rejects checkout for disabled providers and inactive plans, and prices from the plan row', async () => {
    const user = await db.addUser()
    await db.as(null)
    await db.query(`UPDATE public.payment_providers SET is_enabled = false`)
    await db.query(`UPDATE public.subscription_plans SET is_active = false WHERE code <> 'free'`)
    const { id: planId } = await db.one<{ id: string }>(`SELECT id FROM public.subscription_plans WHERE code = 'premium_monthly'`)
    await expect(createTx(user, planId)).rejects.toThrow(/provider_unavailable/)
    await db.query(`UPDATE public.payment_providers SET is_enabled = true WHERE provider = 'paystack'`)
    await expect(createTx(user, planId)).rejects.toThrow(/plan_unavailable/)
    await db.query(`UPDATE public.subscription_plans SET is_active = true WHERE code = 'premium_monthly'`)
    const tx = await createTx(user, planId)
    expect(tx).toMatchObject({ status: 'pending', currency: 'NGN' })
    expect(Number(tx.amount_minor)).toBe(499900)
    expect(tx.reference).toMatch(/^ABIA[0-9A-F]{24}$/)
  })

  it('fulfils a payment exactly once even when the webhook is delivered repeatedly', async () => {
    const user = await db.addUser()
    const planId = await enableCheckout()
    const tx = await createTx(user, planId)
    expect(await apply(tx.reference, 'success', tx.amount_minor)).toBe('fulfilled')
    expect(await apply(tx.reference, 'success', tx.amount_minor)).toBe('already_fulfilled')
    expect(await apply(tx.reference, 'success', tx.amount_minor)).toBe('already_fulfilled')
    // A late "failed" event must not undo a successful payment.
    expect(await apply(tx.reference, 'failed', 0)).toBe('already_fulfilled')
    await db.as(null)
    const { n } = await db.one<{ n: number }>(`SELECT count(*)::int n FROM public.user_subscriptions WHERE user_id = $1`, [user])
    expect(n).toBe(1)
    expect(await entitlements(user)).toMatchObject({ tier: 'premium', is_premium: true })
  })

  it('does not grant access when the amount or currency is wrong', async () => {
    const user = await db.addUser()
    const planId = await enableCheckout()
    const tx = await createTx(user, planId)
    expect(await apply(tx.reference, 'success', 100)).toBe('amount_mismatch')
    expect(await apply(tx.reference, 'success', tx.amount_minor)).toBe('ignored_amount_mismatch')
    const tx2 = await createTx(user, planId)
    expect(await apply(tx2.reference, 'success', tx2.amount_minor, 'USD')).toBe('amount_mismatch')
    expect((await entitlements(user)).is_premium).toBe(false)
  })

  it('marks failures, ignores unknown references', async () => {
    const user = await db.addUser()
    const planId = await enableCheckout()
    const tx = await createTx(user, planId)
    expect(await apply(tx.reference, 'failed', 0)).toBe('marked_failed')
    expect(await apply('ABIADOESNOTEXIST', 'success', 1)).toBe('unknown_reference')
    expect((await entitlements(user)).is_premium).toBe(false)
  })

  it('extends the same plan on renewal instead of overlapping', async () => {
    const user = await db.addUser()
    const planId = await enableCheckout()
    const t1 = await createTx(user, planId)
    await apply(t1.reference, 'success', t1.amount_minor)
    const t2 = await createTx(user, planId)
    await apply(t2.reference, 'success', t2.amount_minor)
    await db.as(null)
    const { days } = await db.one<{ days: number }>(
      `SELECT extract(day FROM max(ends_at) - min(starts_at))::int AS days FROM public.user_subscriptions WHERE user_id = $1`,
      [user],
    )
    expect(days).toBe(60)
  })

  it('revokes access on refund, idempotently, and keeps the record', async () => {
    const user = await db.addUser()
    const planId = await enableCheckout()
    const tx = await createTx(user, planId)
    await apply(tx.reference, 'success', tx.amount_minor)
    await db.as(null)
    const r1 = await db.one<{ r: string }>(`SELECT public.payment_apply_refund('paystack', $1) AS r`, [tx.reference])
    const r2 = await db.one<{ r: string }>(`SELECT public.payment_apply_refund('paystack', 'PS-' || $1) AS r`, [tx.reference])
    expect([r1.r, r2.r]).toEqual(['refunded', 'already_refunded'])
    const row = await db.one<{ status: string }>(`SELECT status FROM public.payment_transactions WHERE reference = $1`, [tx.reference])
    expect(row.status).toBe('refunded')
    expect((await entitlements(user)).is_premium).toBe(false)
  })

  it('blocks checkout for banned users', async () => {
    const banned = await db.addUser({ banned: true })
    const planId = await enableCheckout()
    await expect(createTx(banned, planId)).rejects.toThrow(/account_restricted/)
  })
})

describe('wallet ledger', () => {
  const walletApply = async (user: string, amount: number, key: string, type = 'BONUS') => {
    await db.as(null)
    return db.one<{ balance_before: string; balance_after: string; id: string }>(
      `SELECT * FROM public.wallet_apply($1, $2, $3, $4)`,
      [user, amount, type, key],
    )
  }

  it('records every change, is idempotent and never goes negative', async () => {
    const user = await db.addUser()
    const credit = await walletApply(user, 100, 'bonus-key-0001')
    const replay = await walletApply(user, 100, 'bonus-key-0001')
    expect(replay.id).toBe(credit.id)
    await walletApply(user, -30, 'spend-key-00001', 'BOOST_SPEND')
    await expect(walletApply(user, -500, 'spend-key-00002', 'BOOST_SPEND')).rejects.toThrow(/insufficient_balance/)

    const { balance } = await db.one<{ balance: string }>(`SELECT balance FROM public.wallets WHERE user_id = $1`, [user])
    expect(Number(balance)).toBe(70)
    const ledger = await db.query<{ amount: string; balance_after: string }>(
      `SELECT amount, balance_after FROM public.wallet_transactions WHERE user_id = $1 ORDER BY created_at`,
      [user],
    )
    expect(ledger.rows.map((r) => Number(r.amount))).toEqual([100, -30])
    expect(Number(ledger.rows.at(-1)!.balance_after)).toBe(70)
  })
})

describe('admin controls', () => {
  it('only admins can grant premium, and grants are audited', async () => {
    const admin = await db.addUser({ admin: true })
    const user = await db.addUser()
    await db.as(user)
    await expect(db.query(`SELECT public.admin_grant_subscription($1, 'premium_monthly', 7)`, [user])).rejects.toThrow(/Forbidden/)
    await db.as(admin)
    await db.query(`SELECT public.admin_grant_subscription($1, 'premium_monthly', 7, 'support gesture')`, [user])
    expect((await entitlements(user)).is_premium).toBe(true)
    await db.as(null)
    const { n } = await db.one<{ n: number }>(
      `SELECT count(*)::int n FROM public.monetization_audit_log WHERE action = 'subscription.grant' AND target = $1`,
      [user],
    )
    expect(n).toBe(1)
  })

  it('protects the free plan and audits plan edits', async () => {
    await db.as(null)
    await expect(db.query(`UPDATE public.subscription_plans SET price_minor = 100 WHERE code = 'free'`)).rejects.toThrow(/free plan/)
    await expect(db.query(`DELETE FROM public.subscription_plans WHERE code = 'free'`)).rejects.toThrow(/free plan/)
    await db.query(`UPDATE public.subscription_plans SET price_minor = 550000 WHERE code = 'vip_monthly'`)
    const { n } = await db.one<{ n: number }>(
      `SELECT count(*)::int n FROM public.monetization_audit_log WHERE action = 'subscription_plans.update' AND target = 'vip_monthly'`,
    )
    expect(n).toBeGreaterThanOrEqual(1)
  })
})

describe('payment API keys in Vault', () => {
  const KEY = 'sk_test_4f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c'

  it('only admins can save keys; the dashboard only ever sees a masked preview', async () => {
    const admin = await db.addUser({ admin: true })
    const user = await db.addUser()
    await db.as(user)
    await expect(db.query(`SELECT public.admin_set_payment_secret('PAYSTACK_TEST_SECRET_KEY', $1)`, [KEY])).rejects.toThrow(/Forbidden/)

    await db.as(admin)
    const { preview } = await db.one<{ preview: string }>(
      `SELECT public.admin_set_payment_secret('PAYSTACK_TEST_SECRET_KEY', $1) AS preview`,
      [KEY],
    )
    expect(preview).toBe('sk_test_xxxxxxxxxx')
    await expect(db.query(`SELECT public.admin_set_payment_secret('PAYSTACK_TEST_SECRET_KEY', 'short')`)).rejects.toThrow(/valid API key/)
    await expect(db.query(`SELECT public.admin_set_payment_secret('SOMETHING_ELSE', $1)`, [KEY])).rejects.toThrow(/Unknown key name/)

    // Nothing readable by signed-in users (admins included) contains the key.
    const meta = await db.asRole('authenticated', async () => {
      await expect(db.query(`SELECT * FROM public.get_payment_secrets()`)).rejects.toThrow(/permission denied/)
      await expect(db.query(`SELECT * FROM vault.decrypted_secrets`)).rejects.toThrow(/permission denied/)
      return db.query(`SELECT * FROM public.payment_secret_settings`)
    })
    expect(JSON.stringify(meta.rows)).not.toContain(KEY)
    expect(meta.rows).toHaveLength(1)

    // The service role (edge functions) can decrypt it.
    await db.as(null)
    const { value } = await db.one<{ value: string }>(`SELECT value FROM public.get_payment_secrets() WHERE name = 'PAYSTACK_TEST_SECRET_KEY'`)
    expect(value).toBe(KEY)

    // Replacing keeps a single vault entry and updates the preview.
    await db.as(admin)
    await db.query(`SELECT public.admin_set_payment_secret('PAYSTACK_TEST_SECRET_KEY', 'sk_test_REPLACEDKEY0000000000')`)
    await db.as(null)
    const { n } = await db.one<{ n: number }>(`SELECT count(*)::int n FROM vault.secrets WHERE name = 'payment:PAYSTACK_TEST_SECRET_KEY'`)
    expect(n).toBe(1)
    const audit = await db.query<{ action: string; new_value: unknown }>(
      `SELECT action, new_value FROM public.monetization_audit_log WHERE target = 'PAYSTACK_TEST_SECRET_KEY' ORDER BY id`,
    )
    expect(audit.rows.map((r) => r.action)).toEqual(['payment_secret.set', 'payment_secret.replace'])
    expect(JSON.stringify(audit.rows)).not.toContain('REPLACEDKEY')
  })

  it('removing a key deletes it from Vault and switches that provider off', async () => {
    const admin = await db.addUser({ admin: true })
    await db.as(admin)
    await db.query(`SELECT public.admin_set_payment_secret('SQUAD_TEST_SECRET_KEY', 'sandbox_sk_94f2b798466408ef4d19')`)
    await db.as(null)
    await db.query(`UPDATE public.payment_providers SET is_enabled = true, mode = 'test' WHERE provider = 'squad'`)
    await db.as(admin)
    await db.query(`SELECT public.admin_clear_payment_secret('SQUAD_TEST_SECRET_KEY')`)
    await db.as(null)
    const { n } = await db.one<{ n: number }>(`SELECT count(*)::int n FROM vault.secrets WHERE name = 'payment:SQUAD_TEST_SECRET_KEY'`)
    expect(n).toBe(0)
    const { is_enabled } = await db.one<{ is_enabled: boolean }>(`SELECT is_enabled FROM public.payment_providers WHERE provider = 'squad'`)
    expect(is_enabled).toBe(false)
  })
})

describe('push internal secret rotation', () => {
  const LEAKED = '5420eafda19fe97e5fc2ed8f58dfab39e887beff183b478a800a891c874ace40'

  it('stores a fresh random token in Vault that only the service role can read', async () => {
    await db.as(null)
    const { value } = await db.one<{ value: string }>(`SELECT public.get_push_internal_secret() AS value`)
    expect(value).toMatch(/^[0-9a-f]{64}$/)
    expect(value).not.toBe(LEAKED)

    const user = await db.addUser()
    await db.as(user)
    await db.asRole('authenticated', () =>
      expect(db.query(`SELECT public.get_push_internal_secret()`)).rejects.toThrow(/permission denied/),
    )
  })

  it('replaces an existing (leaked) token when re-run', async () => {
    await db.as(null)
    await db.query(`UPDATE vault.secrets SET secret = $1 WHERE name = 'push_internal_secret'`, [LEAKED])
    const sql = (await import('node:fs')).readFileSync(
      (await import('node:path')).resolve(__dirname, '../../../supabase/migrations/20261001160000_rotate_push_internal_secret.sql'),
      'utf8',
    )
    await db.exec(sql)
    const { value } = await db.one<{ value: string }>(`SELECT public.get_push_internal_secret() AS value`)
    expect(value).not.toBe(LEAKED)
    const { n } = await db.one<{ n: number }>(`SELECT count(*)::int n FROM vault.secrets WHERE name = 'push_internal_secret'`)
    expect(n).toBe(1)
  })
})
