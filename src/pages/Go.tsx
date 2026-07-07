import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'

/**
 * /go/:token — resolves a one-time short link (minted by auth-email-hook) and
 * redirects to the real verification URL. Keeps the backend host out of the
 * email body so users don't see internal infrastructure.
 */
export default function Go() {
  const { token } = useParams<{ token: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!token) { setError('Missing link token.'); return }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: rpcErr } = await (supabase.rpc as any)('consume_email_short_link', { _token: token })
        if (cancelled) return
        if (rpcErr) { setError('This link could not be verified. Please request a new one.'); return }
        if (!data) { setError('This link has expired or already been used. Please request a new one.'); return }
        window.location.replace(String(data))
      } catch {
        if (!cancelled) setError('Something went wrong. Please try again.')
      }
    }
    void run()
    return () => { cancelled = true }
  }, [token])

  return (
    <>
      <SEO title="Continue" description="Redirecting…" path="/go" />
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Link unavailable</h1>
            <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
            <a href="/login" className="text-sm text-primary hover:underline">Back to sign in</a>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">One moment, continuing securely…</p>
          </>
        )}
      </div>
    </>
  )
}
