import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, Heart, Loader2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'
import { DONATION_REFERENCE_KEY } from '@/components/donate/DonateOnlineCard'

const REFERENCE_RE = /^ABIA[0-9A-F]{24}$/
const POLL_MS = 3000
const MAX_POLLS = 20 // about a minute, then the provider's webhook finishes it

type View = 'checking' | 'success' | 'failed' | 'abandoned' | 'mismatch' | 'refunded' | 'delayed'

function readPendingReference(): string | null {
  try {
    return sessionStorage.getItem(DONATION_REFERENCE_KEY)
  } catch {
    return null
  }
}

/**
 * Where donors land after paying. The URL is never trusted: the server
 * re-verifies the payment with the provider and reports the real status.
 */
export default function DonationCallback() {
  const [params] = useSearchParams()
  const reference = [
    params.get('reference'),
    params.get('paymentReference'),
    params.get('trxref'),
    params.get('transaction_ref'),
    readPendingReference(),
  ].find((r) => r && REFERENCE_RE.test(r)) ?? null

  const [view, setView] = useState<View>('checking')
  const [amountMinor, setAmountMinor] = useState<number | null>(null)
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
        const { data } = await supabase.functions.invoke('payments-verify', { body: { reference } })
        if (cancelled) return
        if (typeof data?.amountMinor === 'number') setAmountMinor(data.amountMinor)
        const s = data?.status as string | undefined
        const next: View | null =
          s === 'success' ? 'success'
          : s === 'failed' ? 'failed'
          : s === 'abandoned' ? 'abandoned'
          : s === 'amount_mismatch' ? 'mismatch'
          : s === 'refunded' ? 'refunded'
          : null
        if (next) {
          setView(next)
          if (next === 'success') {
            try {
              sessionStorage.removeItem(DONATION_REFERENCE_KEY)
            } catch {
              /* ignore */
            }
          }
          return
        }
      } catch {
        /* temporary problem; keep checking */
      }
      if (polls.current >= MAX_POLLS) setView('delayed')
      else timer = setTimeout(check, POLL_MS)
    }
    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reference])

  const amount = amountMinor != null ? `₦${(amountMinor / 100).toLocaleString('en-NG')}` : 'your donation'
  const content: Record<View, { icon: React.ReactNode; title: string; text: string }> = {
    checking: {
      icon: <Loader2 className="size-10 animate-spin text-muted-foreground" />,
      title: 'Confirming your donation…',
      text: 'This usually takes a few seconds.',
    },
    delayed: {
      icon: <Clock className="size-10 text-amber-500" />,
      title: 'Almost there',
      text: 'Your payment is still being confirmed by the payment provider. It will be recorded automatically; you can close this page.',
    },
    success: {
      icon: <CheckCircle2 className="size-10 text-emerald-600" />,
      title: 'Thank you! 💚',
      text: `We received ${amount}. Your support keeps AbiaConnect free and growing for every Abian.`,
    },
    failed: {
      icon: <XCircle className="size-10 text-rose-600" />,
      title: 'Payment not completed',
      text: 'The payment did not go through and you were not charged. You can try again.',
    },
    abandoned: {
      icon: <XCircle className="size-10 text-muted-foreground" />,
      title: 'Payment cancelled',
      text: 'No money was taken. You can donate again whenever you like.',
    },
    mismatch: {
      icon: <XCircle className="size-10 text-amber-500" />,
      title: 'We need to check this payment',
      text: 'The amount received did not match. Our team will review it and contact you if needed.',
    },
    refunded: {
      icon: <XCircle className="size-10 text-muted-foreground" />,
      title: 'Donation refunded',
      text: 'This donation was refunded to you.',
    },
  }
  const { icon, title, text } = content[view]

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <SEO title="Donation" description="Donation status" path="/donate/callback" />
      <div className="mx-auto mb-4 grid size-16 place-items-center" aria-hidden>
        {icon}
      </div>
      <h1 className="text-2xl font-bold" role="status" aria-live="polite">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
      {reference && <p className="mt-3 text-xs text-muted-foreground">Reference: {reference}</p>}
      <div className="mt-8 flex flex-col gap-2">
        {view === 'success' ? (
          <Button asChild className="rounded-full">
            <Link to="/">
              <Heart /> Back to AbiaConnect
            </Link>
          </Button>
        ) : (
          <Button asChild className="rounded-full">
            <Link to="/donate">Back to donate</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
