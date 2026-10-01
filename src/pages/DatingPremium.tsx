import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Crown, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SEO } from '@/components/SEO'
import { useDatingEntitlements } from '@/hooks/useDatingEntitlements'
import {
  canPurchaseHere,
  getMyPayments,
  getPaymentOptions,
  getPlans,
  PENDING_REFERENCE_KEY,
  startCheckout,
  track,
  type Plan,
} from '@/lib/monetization/api'
import { formatMoney, t } from '@/lib/monetization/strings'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'

type Period = 'month' | 'year'

const STATUS_LABEL: Record<string, string> = {
  success: 'Paid',
  pending: 'Processing',
  failed: 'Failed',
  abandoned: 'Cancelled',
  refunded: 'Refunded',
  amount_mismatch: 'Needs review',
}

export default function DatingPremium() {
  const purchasable = canPurchaseHere()
  const { data: ent } = useDatingEntitlements()
  const plansQ = useQuery({ queryKey: ['dating-plans'], queryFn: getPlans, enabled: purchasable })
  const optionsQ = useQuery({ queryKey: ['payment-options'], queryFn: getPaymentOptions, enabled: purchasable })
  const historyQ = useQuery({ queryKey: ['my-payments'], queryFn: getMyPayments })
  const [period, setPeriod] = useState<Period>('month')
  const [provider, setProvider] = useState<string | undefined>()
  const [startingPlan, setStartingPlan] = useState<string | null>(null)

  useEffect(() => track('PREMIUM_PAGE_VIEWED'), [])

  const options = useMemo(() => optionsQ.data ?? [], [optionsQ.data])
  useEffect(() => {
    if (!provider && options.length) setProvider(options[0].provider)
  }, [options, provider])

  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data])
  const free = plans.find((p) => p.tier === 'free')
  const hasYearly = plans.some((p) => p.tier !== 'free' && p.billing_period === 'year')
  const paid = useMemo(
    () => plans.filter((p) => p.tier !== 'free' && (!hasYearly || p.billing_period === period)),
    [plans, period, hasYearly],
  )

  const checkout = async (plan: Plan) => {
    if (!provider) return
    track('PRODUCT_SELECTED', { plan: plan.code, provider })
    setStartingPlan(plan.id)
    try {
      const { checkoutUrl, reference } = await startCheckout(plan.id, provider)
      try {
        sessionStorage.setItem(PENDING_REFERENCE_KEY, reference)
      } catch {
        /* storage unavailable; the provider's return parameters still work */
      }
      window.location.assign(checkoutUrl)
    } catch (e) {
      toast.error(e instanceof Error && e.message !== 'Request failed' ? e.message : t('checkout.error'))
      setStartingPlan(null)
    }
  }

  const providerName = options.find((o) => o.provider === provider)?.display_name ?? ''

  return (
    <div className="mx-auto max-w-5xl">
      <SEO title="Premium" description="Upgrade your AbiaConnect dating experience." path="/relationship/premium" />
      <div className="mb-2 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Back to Relationship">
          <Link to="/relationship">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
      </div>

      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-pink-600 shadow-lg">
          <Crown className="size-7 text-white" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t('pricing.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('pricing.subtitle')}</p>
      </header>

      {ent && (
        <section className="mx-auto mb-6 max-w-xl rounded-2xl border border-border bg-card p-4 text-center" aria-live="polite">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('pricing.current_plan')}</p>
          <p className="mt-1 text-lg font-semibold">{ent.plan_name}</p>
          {ent.ends_at && (
            <p className="text-sm text-muted-foreground">
              {t('pricing.active_until', { date: new Date(ent.ends_at).toLocaleDateString() })}
            </p>
          )}
        </section>
      )}

      {!purchasable ? (
        <p className="mx-auto max-w-xl rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
          {t('pricing.app_store_notice')}
        </p>
      ) : plansQ.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      ) : !paid.length || !options.length ? (
        <p className="mx-auto max-w-xl rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
          {t('pricing.unavailable')}
        </p>
      ) : (
        <>
          {hasYearly && (
            <div className="mb-6 flex justify-center">
              <div className="inline-flex rounded-full bg-muted p-1" role="radiogroup" aria-label="Billing period">
                {(['month', 'year'] as Period[]).map((p) => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={period === p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                      period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    {p === 'month' ? t('pricing.monthly') : t('pricing.yearly')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {free && <PlanCard plan={free} current={ent?.plan_code === 'free'} />}
            {paid.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={ent?.plan_code === plan.code}
                onChoose={() => checkout(plan)}
                loading={startingPlan === plan.id}
                disabled={!!startingPlan}
              />
            ))}
          </div>

          {options.length > 1 && (
            <fieldset className="mx-auto mt-6 max-w-xl text-center">
              <legend className="mb-2 text-sm font-medium">{t('pricing.pay_with')}</legend>
              <div className="flex flex-wrap justify-center gap-2">
                {options.map((o) => (
                  <label
                    key={o.provider}
                    className={cn(
                      'cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors',
                      provider === o.provider ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:bg-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={o.provider}
                      checked={provider === o.provider}
                      onChange={() => setProvider(o.provider)}
                      className="sr-only"
                    />
                    {o.display_name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <p className="mx-auto mt-6 flex max-w-xl items-start justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t('pricing.billing_info', { days: paid[0]?.duration_days ?? 30 })} {t('pricing.secure', { provider: providerName })}
            </span>
          </p>
        </>
      )}

      <section className="mx-auto mt-10 max-w-xl">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('pricing.history')}</h2>
        {!historyQ.data?.length ? (
          <p className="text-sm text-muted-foreground">{t('pricing.no_history')}</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm">
            {historyQ.data.map((p) => (
              <li key={p.reference} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.plan?.name ?? 'Purchase'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()} · {p.reference}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatMoney(Number(p.amount_minor), p.currency)}</p>
                  <p className="text-xs text-muted-foreground">{STATUS_LABEL[p.status] ?? p.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PlanCard({
  plan,
  current,
  onChoose,
  loading,
  disabled,
}: {
  plan: Plan
  current?: boolean
  onChoose?: () => void
  loading?: boolean
  disabled?: boolean
}) {
  const price = plan.promo_price_minor ?? plan.price_minor
  const isFree = plan.tier === 'free'
  return (
    <article
      className={cn(
        'relative flex flex-col rounded-3xl border bg-card p-6',
        plan.is_recommended ? 'border-pink-500 shadow-lg shadow-pink-500/10' : 'border-border',
      )}
      aria-label={plan.name}
    >
      {plan.is_recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-500 to-rose-600 px-3 py-0.5 text-xs font-semibold text-white">
          {t('pricing.recommended')}
        </span>
      )}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
      <div className="mt-4">
        {isFree ? (
          <p className="text-3xl font-bold">{t('pricing.free_forever')}</p>
        ) : (
          <>
            <p className="text-3xl font-bold">
              {formatMoney(price, plan.currency)}
              <span className="text-sm font-normal text-muted-foreground">
                {plan.billing_period === 'year' ? t('pricing.per_year') : t('pricing.per_month')}
              </span>
            </p>
            {plan.promo_price_minor != null && plan.promo_price_minor < plan.price_minor && (
              <p className="text-sm text-muted-foreground line-through">{formatMoney(plan.price_minor, plan.currency)}</p>
            )}
            {plan.billing_period === 'year' && (
              <p className="text-xs text-muted-foreground">
                {t('pricing.effective_monthly', { price: formatMoney(Math.round(price / 12), plan.currency) })}
              </p>
            )}
          </>
        )}
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {(plan.features ?? []).map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      {current && isFree ? (
        <p className="mt-6 text-center text-sm font-medium text-muted-foreground">{t('pricing.current_plan')}</p>
      ) : onChoose ? (
        <Button
          className={cn(
            'mt-6 w-full rounded-full',
            plan.is_recommended && 'bg-gradient-to-r from-pink-500 to-rose-600 text-white hover:opacity-95',
          )}
          variant={plan.is_recommended ? 'default' : 'outline'}
          onClick={onChoose}
          disabled={disabled}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t('checkout.starting')}
            </>
          ) : current ? (
            t('pricing.extend', { plan: plan.name })
          ) : (
            t('pricing.choose', { plan: plan.name })
          )}
        </Button>
      ) : null}
    </article>
  )
}
