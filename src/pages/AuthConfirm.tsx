import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toFriendlyAuthError } from '@/lib/friendlyAuthError'
import { SEO } from '@/components/SEO'

/**
 * Branded confirmation endpoint for auth emails (signup, magiclink, recovery,
 * invite, email_change, reauthentication). The auth email links point here
 * with `?token_hash=...&type=...&next=...` so the Supabase project URL never
 * appears in the email body or the user's address bar. We exchange the
 * token_hash for a session locally, then forward to `next`.
 */
export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')
  const [message, setMessage] = useState<string>('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const tokenHash = params.get('token_hash')
    const type = (params.get('type') || 'signup') as
      | 'signup'
      | 'magiclink'
      | 'recovery'
      | 'invite'
      | 'email_change'
      | 'email'
    // Only continue to a page on this site, never to another website.
    const rawNext = params.get('next') || '/'
    const next =
      type === 'recovery'
        ? '/reset-password'
        : rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.startsWith('/\\')
          ? rawNext
          : '/'

    if (!tokenHash) {
      setStatus('error')
      setMessage(toFriendlyAuthError(new Error('missing')).message)
      return
    }

    void (async () => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
        if (error) {
          // Never surface raw backend text — could include host names or
          // internal details. Map to a curated friendly message.
          setStatus('error')
          setMessage(toFriendlyAuthError(error).message)
          return
        }
        navigate(next, { replace: true })
      } catch (e) {
        setStatus('error')
        setMessage(toFriendlyAuthError(e).message)
      }
    })()
  }, [params, navigate])

  return (
    <>
      <SEO
        title="Confirming · AbiaConnect"
        description="Verifying your secure link."
        path="/auth/confirm"
      />
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-8 text-center">
          {status === 'verifying' && (
            <>
              <div className="h-10 w-10 mx-auto mb-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <h1 className="text-lg font-semibold mb-1">Verifying your link…</h1>
              <p className="text-sm text-muted-foreground">
                One moment while we confirm your secure link.
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertTriangle className="size-10 mx-auto text-destructive mb-3" />
              <h1 className="text-lg font-semibold mb-1">Link invalid or expired</h1>
              <p className="text-sm text-muted-foreground mb-5">{message}</p>
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link to="/forgot-password">Request a new link</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/login">Back to Sign In</Link>
                </Button>
              </div>
            </>
          )}
          {/* keep the success icon imported so tree-shaking sees it for future states */}
          <CheckCircle2 className="hidden" />
        </div>
      </div>
    </>
  )
}
