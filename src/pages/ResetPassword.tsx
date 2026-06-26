import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Zap, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'
import { motion } from 'framer-motion'

const BRAND = {
  bg: '#0D0D0D',
  surface: '#1E1E1E',
  gold: '#C8A951',
  goldDark: '#8A7A3A',
  text: '#FFFFFF',
  textMuted: '#B0B0B0',
};

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0D0D0D] overflow-y-auto font-sans">
      <SEO
        title="Set a new password · AbiaConnect"
        description="Create a new password for your AbiaConnect account."
        path="/reset-password"
      />

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: BRAND.gold }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full px-6 py-12 min-h-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-20 h-20 mb-6 flex items-center justify-center rounded-2xl bg-[#1E1E1E] border border-white/5 shadow-2xl text-gold-500">
            <Lock className="size-10" style={{ color: BRAND.gold }} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Secure Reset</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#161616] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl"
        >
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="size-12 rounded-full border-2 border-white/5 border-t-gold-500 animate-spin" style={{ borderTopColor: BRAND.gold }} />
              <p className="text-sm font-medium" style={{ color: BRAND.textMuted }}>Verifying your secure link…</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <AlertTriangle className="size-10 mx-auto text-red-500 mb-3" />
                <h2 className="text-xl font-bold text-white mb-2">Link Expired</h2>
                <p className="text-sm leading-relaxed" style={{ color: BRAND.textMuted }}>
                  {errorMsg ?? 'This password reset link is invalid or has expired.'}
                </p>
              </div>
              <div className="space-y-3">
                {recoveryEmail ? (
                  <Button className="w-full h-14 rounded-xl font-bold gap-2" style={{ background: BRAND.gold, color: BRAND.bg }} onClick={handleResend} disabled={resending}>
                    <Mail className="size-4" /> {resending ? 'Sending…' : 'Resend Reset Email'}
                  </Button>
                ) : (
                  <Button asChild className="w-full h-14 rounded-xl font-bold" style={{ background: BRAND.gold, color: BRAND.bg }}>
                    <Link to="/forgot-password">Request New Link</Link>
                  </Button>
                )}
                <Button asChild variant="ghost" className="w-full text-white/40 hover:text-white">
                  <Link to="/login"><ArrowLeft className="mr-2 size-4" /> Back to Sign In</Link>
                </Button>
              </div>
            </div>
          )}

          {status === 'resent' && (
            <div className="text-center space-y-6">
              <div className="size-16 rounded-full flex items-center justify-center mx-auto" style={{ background: `${BRAND.gold}20` }}>
                <CheckCircle2 className="size-8" style={{ color: BRAND.gold }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Email Sent</h2>
                <p className="text-sm leading-relaxed" style={{ color: BRAND.textMuted }}>
                  A new link was sent to <strong>{recoveryEmail}</strong>. Please check your inbox.
                </p>
              </div>
              <Button asChild className="w-full h-14 rounded-xl font-bold" style={{ background: BRAND.gold, color: BRAND.bg }}>
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </div>
          )}

          {(status === 'ready' || status === 'updating') && (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest ml-1 opacity-50">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-white/20" />
                  <Input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border-white/5 bg-[#0D0D0D] text-white pl-12 pr-12"
                    placeholder="New Security Password"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest ml-1 opacity-50">Confirm Password</Label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-white/20" />
                  <Input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-14 rounded-2xl border-white/5 bg-[#0D0D0D] text-white pl-12"
                    placeholder="Confirm Security Password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-16 rounded-2xl text-lg font-bold" style={{ background: BRAND.gold, color: BRAND.bg }} disabled={status === 'updating'}>
                {status === 'updating' ? 'Updating Security...' : 'Update Password'}
              </Button>
            </form>
          )}

          {status === 'done' && (
            <div className="text-center space-y-6">
              <div className="size-16 rounded-full flex items-center justify-center mx-auto" style={{ background: `${BRAND.gold}20` }}>
                <CheckCircle2 className="size-8" style={{ color: BRAND.gold }} />
              </div>
              <h2 className="text-xl font-bold text-white">Success!</h2>
              <p className="text-sm" style={{ color: BRAND.textMuted }}>Your password has been updated. One moment while we redirect you...</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
