import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'

type Status = 'verifying' | 'ready' | 'invalid' | 'updating' | 'done' | 'resent'

function getEmailFromHash(): string | null {
  try {
    const hash = window.location.hash || ''
    const m = hash.match(/access_token=([^&]+)/)
    if (!m) return null
    const payload = JSON.parse(atob(m[1].split('.')[1]))
    return payload?.email || null
  } catch {
    return null
  }
}

// Fire-and-forget audit log. Never throws, never blocks the UI, never exposes
// details to the user. The edge function always returns 204.
async function logResetEvent(
  event: 'verified' | 'invalid' | 'updated' | 'resent' | 'resend_failed',
  email: string | null,
) {
  try {
    await supabase.functions.invoke('log-reset-token-event', {
      body: { event, email: email ?? undefined },
    })
  } catch {
    // swallow — auditing must never surface to the user
  }
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  // Verify the recovery link. Supabase JS auto-parses the URL hash on load
  // and fires a PASSWORD_RECOVERY event. We also fall back to checking for an
  // existing session in case the listener already ran.
  useEffect(() => {
    let resolved = false

    const finish = (ok: boolean, email: string | null, msg?: string) => {
      if (resolved) return
      resolved = true
      if (ok) {
        setStatus('ready')
        void logResetEvent('verified', email)
      } else {
        setErrorMsg(msg ?? 'This password reset link is invalid or has expired.')
        setStatus('invalid')
        void logResetEvent('invalid', email)
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        const email = session.user.email ?? getEmailFromHash()
        setRecoveryEmail(email)
        finish(true, email)
      }
    })

    // Fallback: maybe the hash was already consumed before the listener mounted.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      const hash = window.location.hash || ''
      const email = data.session?.user.email ?? getEmailFromHash()
      if (data.session && hash.includes('type=recovery')) {
        setRecoveryEmail(email)
        finish(true, email)
      } else if (data.session && !hash) {
        setRecoveryEmail(email)
        finish(true, email)
      } else {
        setRecoveryEmail(email)
        finish(false, email)
      }
    }, 1200)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

  async function handleResend() {
    const email = recoveryEmail?.trim()
    if (!email) {
      toast.error('Unable to determine your email. Please request a new link.')
      return
    }
    setResending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    setResending(false)
    if (error) {
      void logResetEvent('resend_failed', email)
      toast.error(error.message)
      return
    }
    void logResetEvent('resent', email)
    setStatus('resent')
    toast.success('A new reset link has been sent to your email.')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.')
      return
    }
    setStatus('updating')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
      setStatus('ready')
      return
    }
    void logResetEvent('updated', recoveryEmail)
    await supabase.auth.signOut()
    setStatus('done')
    toast.success('Password updated. Please sign in.')
    setTimeout(() => navigate('/login', { replace: true }), 1800)
  }

  return (
    <>
      <SEO
        title="Set a new password · AbiaConnect"
        description="Create a new password for your AbiaConnect account."
        path="/reset-password"
      />
      <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 rounded-3xl p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-8">
          <div className="flex flex-col items-center gap-3 mb-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
              <Zap className="size-6" />
            </span>
            <h1 className="text-2xl font-bold">Set a new password</h1>
            <p className="text-sm text-muted-foreground text-center">
              Choose a strong password you haven't used before.
            </p>
          </div>

          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Verifying your reset link…</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
                <AlertTriangle className="size-10 mx-auto text-destructive mb-3" />
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Link invalid or expired
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {errorMsg ?? 'This password reset link is invalid or has expired.'}
                </p>
              </div>
              <div className="space-y-3">
                {recoveryEmail ? (
                  <Button
                    className="w-full gap-2"
                    onClick={handleResend}
                    disabled={resending}
                  >
                    <Mail className="size-4" />
                    {resending ? 'Sending…' : 'Resend reset email'}
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/forgot-password">Request a new link</Link>
                  </Button>
                )}
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/login">Back to Sign In</Link>
                </Button>
              </div>
            </div>
          )}

          {status === 'resent' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="size-12 mx-auto text-primary" />
              <p className="text-sm leading-relaxed">
                A new reset link has been sent to{' '}
                <strong>{recoveryEmail}</strong>. Please check your inbox (and spam folder)
                and follow the link to continue.
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </div>
          )}

          {(status === 'ready' || status === 'updating') && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use at least 8 characters. Avoid passwords you use on other sites.
              </p>
              <Button type="submit" className="w-full" disabled={status === 'updating'}>
                {status === 'updating' ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}

          {status === 'done' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="size-12 mx-auto text-primary" />
              <p className="text-sm">
                Your password has been updated. Redirecting you to sign in…
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/login">Go to Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
