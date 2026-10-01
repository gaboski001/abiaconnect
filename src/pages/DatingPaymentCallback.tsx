import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'
import { PENDING_REFERENCE_KEY, verifyPayment } from '@/lib/monetization/api'
import { t } from '@/lib/monetization/strings'

const REFERENCE_RE = /^ABIA[0-9A-F]{24}$/

function readPendingReference(): string | null {
  try {
    return sessionStorage.getItem(PENDING_REFERENCE_KEY)
  } catch {
    return null
  }
}

type View = 'checking' | 'success' | 'failed' | 'abandoned' | 'mismatch' | 'refunded' | 'delayed'

const POLL_MS = 3000
const MAX_POLLS = 20 // ~1 minute, then hand over to the webhook

/**
 * Landing page after the provider's hosted checkout. The URL is never trusted:
 * the server re-verifies with the provider and reports the real status.
 */
export default function DatingPaymentCallback() {
  const [params] = useSearchParams()
  const reference = [params.get('reference'), params.get('paymentReference'), params.get('trxref'), params.get('transaction_ref'), readPendingReference()]
    .find((r) => !!r && REFERENCE_RE.test(r)) ?? ''
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('checking')
  const [planName, setPlanName] = useState<string | null>(null)
  const polls = useRef(0)

  useEffect(() => {
    if (!reference) {
      setView('failed')
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const check = async () => {
      polls.current += 1
      try {
        const r = await verifyPayment(reference)
        if (cancelled) return
        setPlanName(r.planName)
        const next: View | null =
          r.status === 'success'
            ? 'success'
            : r.status === 'failed'
              ? 'failed'
              : r.status === 'abandoned'
                ? 'abandoned'
                : r.status === 'amount_mismatch'
                  ? 'mismatch'
                  : r.status === 'refunded'
                    ? 'refunded'
                    : null
        if (next) {
          setView(next)
          if (next === 'success') {
            queryClient.invalidateQueries({ queryKey: ['dating-entitlements'] })
            queryClient.invalidateQueries({ queryKey: ['my-payments'] })
          }
          return
        }
      } catch {
        /* transient; keep polling */
      }
      if (polls.current >= MAX_POLLS) setView('delayed')
      else timer = setTimeout(check, POLL_MS)
    }
    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reference, queryClient])

  const content: Record<View, { icon: React.ReactNode; text: string }> = {
    checking: { icon: <Loader2 className="size-10 animate-spin text-muted-foreground" />, text: t('payment.processing') },
    delayed: { icon: <Clock className="size-10 text-amber-500" />, text: t('payment.activating') },
    success: {
      icon: <CheckCircle2 className="size-10 text-emerald-600" />,
      text: t('payment.success', { plan: planName ?? 'Premium' }),
    },
    failed: { icon: <XCircle className="size-10 text-rose-600" />, text: t('payment.failed') },
    abandoned: { icon: <XCircle className="size-10 text-muted-foreground" />, text: t('payment.abandoned') },
    mismatch: { icon: <XCircle className="size-10 text-amber-500" />, text: t('payment.mismatch') },
    refunded: { icon: <XCircle className="size-10 text-muted-foreground" />, text: t('payment.refunded') },
  }
  const { icon, text } = content[view]

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <SEO title="Payment" description="Payment status" path="/relationship/payment/callback" />
      <div className="mx-auto mb-4 grid size-16 place-items-center" aria-hidden>
        {icon}
      </div>
      <p className="text-lg font-semibold" role="status" aria-live="polite">
        {text}
      </p>
      {reference && <p className="mt-2 text-xs text-muted-foreground">{t('payment.reference', { reference })}</p>}
      <div className="mt-8 flex flex-col gap-2">
        <Button asChild className="rounded-full">
          <Link to={view === 'success' ? '/relationship/likes' : '/relationship/premium'}>
            {view === 'success' ? t('paywall.see_likes.cta') : 'Back to plans'}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="rounded-full">
          <Link to="/relationship">Back to Relationship</Link>
        </Button>
      </div>
    </div>
  )
}
