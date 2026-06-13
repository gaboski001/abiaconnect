import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { SEO } from '@/components/SEO'

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
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Unsubscribe</h1>
          {state === 'loading' && <p className="text-muted-foreground">Validating link…</p>}
          {state === 'invalid' && <p className="text-destructive">This unsubscribe link is invalid or expired.</p>}
          {state === 'already' && <p className="text-muted-foreground">You're already unsubscribed.</p>}
          {state === 'error' && <p className="text-destructive">Something went wrong. Please try again.</p>}
          {state === 'valid' && (
            <>
              <p className="text-muted-foreground">
                Click below to stop receiving emails from AbiaConnect.
              </p>
              <Button onClick={confirm} disabled={submitting} className="w-full">
                {submitting ? 'Unsubscribing…' : 'Confirm Unsubscribe'}
              </Button>
            </>
          )}
          {state === 'done' && (
            <p className="text-foreground">You've been unsubscribed. Sorry to see you go.</p>
          )}
        </div>
      </div>
    </>
  )
}
