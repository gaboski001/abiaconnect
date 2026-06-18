import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'

type Status = 'verifying' | 'ready' | 'invalid' | 'updating' | 'done'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Verify the recovery link. Supabase JS auto-parses the URL hash on load
  // and fires a PASSWORD_RECOVERY event. We also fall back to checking for an
  // existing session in case the listener already ran.
  useEffect(() => {
    let resolved = false

    const finish = (ok: boolean, msg?: string) => {
      if (resolved) return
      resolved = true
      if (ok) {
        setStatus('ready')
      } else {
        setErrorMsg(msg ?? 'This password reset link is invalid or has expired.')
        setStatus('invalid')
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) finish(true)
    })

    // Fallback: maybe the hash was already consumed before the listener mounted.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      const hash = window.location.hash || ''
      if (data.session && hash.includes('type=recovery')) finish(true)
      else if (data.session && !hash) finish(true) // already verified, refresh
      else finish(false)
    }, 1200)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(t)
    }
  }, [])

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
            <div className="text-center space-y-4">
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
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
