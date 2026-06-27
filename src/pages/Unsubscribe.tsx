import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, PREMIUM_SHADOW } from '@/lib/mobileBrand'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

type State = 'loading' | 'valid' | 'invalid' | 'already' | 'done' | 'error'

export default function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<State>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
      headers: { apikey: ANON_KEY },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState('valid')
        else if (d.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => setState('error'))
  }, [token])

  async function confirm() {
    setSubmitting(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({ token }),
      })
      const d = await res.json()
      if (d.success || d.reason === 'already_unsubscribed') setState('done')
      else setState('error')
    } catch {
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SEO title="Unsubscribe" description="Unsubscribe from AbiaConnect emails" path="/unsubscribe" />
      <div className="flex min-h-[70vh] items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] p-6 dark:bg-[linear-gradient(180deg,#050a12_0%,#091220_48%,#050a12_100%)]">
        <div
          className="w-full max-w-xl space-y-4 rounded-[2rem] border border-slate-200/80 bg-white/96 p-8 text-center shadow-[0_24px_80px_-42px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:shadow-none"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/80"
            style={{ background: GOLD_GRADIENT_SOFT }}
          >
            Email preferences
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Unsubscribe</h1>
          {state === 'loading' && <p className="text-slate-600 dark:text-slate-300/76">Validating link…</p>}
          {state === 'invalid' && <p className="text-sm font-medium text-rose-600 dark:text-rose-300">This unsubscribe link is invalid or expired.</p>}
          {state === 'already' && <p className="text-slate-600 dark:text-slate-300/76">You're already unsubscribed.</p>}
          {state === 'error' && <p className="text-sm font-medium text-rose-600 dark:text-rose-300">Something went wrong. Please try again.</p>}
          {state === 'valid' && (
            <>
              <p className="text-slate-600 dark:text-slate-300/76">
                Click below to stop receiving emails from AbiaConnect.
              </p>
              <Button
                onClick={confirm}
                disabled={submitting}
                className="h-12 w-full rounded-2xl border-0 font-bold text-slate-950"
                style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              >
                {submitting ? 'Unsubscribing…' : 'Confirm Unsubscribe'}
              </Button>
            </>
          )}
          {state === 'done' && (
            <p className="text-slate-900 dark:text-slate-100">You've been unsubscribed. Sorry to see you go.</p>
          )}
        </div>
      </div>
    </>
  )
}
