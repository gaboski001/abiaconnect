import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Eye, EyeOff, Fingerprint, ShieldCheck, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { useAuth } from '@/contexts/AuthContext'
import { BiometricLoginButton } from '@/components/auth/BiometricLoginButton'
import { BiometricOptInDialog } from '@/components/auth/BiometricOptInDialog'
import {
  hasDeclinedBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricDeclined,
} from '@/lib/biometric'
import PremiumAuthShell from '@/components/mobile/PremiumAuthShell'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND } from '@/lib/mobileBrand'

const TRUST_POINTS = [
  'Fast, stable sign-in with smoother Android navigation',
  'Fingerprint sign-in available on supported devices',
  'Live alerts for replies, mentions, and direct messages',
]

export default function Login() {
  const navigate = useNavigate()
  const { refreshSession } = useAuth()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [optInOpen, setOptInOpen] = useState(false)
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null)

  const helperLabel = useMemo(() => {
    if (!identifier) return 'Use the email address connected to your AbiaConnect account.'
    if (!identifier.includes('@')) return 'Email format helps the mobile sign-in stay reliable.'
    return 'Looks good — continue with your password.'
  }, [identifier])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setLoading(true)

    const timeout = setTimeout(() => {
      setLoading(false)
      toast.error('Connection timed out. Please check your internet and try again.')
    }, 15000)

    try {
      const email = identifier.trim()
      if (!email.includes('@')) {
        toast.error('Please sign in with your email address.')
        clearTimeout(timeout)
        setLoading(false)
        return
      }

      if (!navigator.onLine) {
        throw new Error('You are currently offline. Please check your internet connection.')
      }

      const { data, error } = (await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth request timed out')), 12000)),
      ])) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>

      clearTimeout(timeout)

      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }

      if (!data?.session) {
        throw new Error('Authentication failed: No session returned.')
      }

      await refreshSession(data.session)

      if (!remember) {
        toast.message('Signed in without changing your saved biometric preference.')
      } else {
        toast.success('Welcome back to AbiaConnect!')
      }

      const pendingPushRoute = typeof window !== 'undefined' ? sessionStorage.getItem('abia_pending_push_route') : null

      try {
        if (!isBiometricEnabled() && !hasDeclinedBiometric() && (await isBiometricAvailable())) {
          setPendingCreds({ email, password })
          setOptInOpen(true)
          setLoading(false)
          return
        }
      } catch {
        // best effort only
      }

      setLoading(false)
      navigate(pendingPushRoute || '/dashboard', { replace: true })
    } catch (err: any) {
      clearTimeout(timeout)
      const errMsg = err?.message || 'Sign in failed. Please check your connection.'
      toast.error(errMsg)
      setLoading(false)
    }
  }

  return (
    <>
      <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account." path="/login" />
      <PremiumAuthShell
        logoUrl={logoUrl}
        badge="Premium Android sign in"
        title="Welcome back to your community hub"
        subtitle="Move from onboarding to conversation with a smoother, more native-feeling sign-in experience built for speed, clarity, and trust."
        panelTitle="Modern access for Abians worldwide"
        panelDescription="The refreshed mobile sign-in flow uses stronger visual hierarchy, motion, and touch-friendly spacing while keeping your existing backend flow intact."
        footer={pendingCreds ? (
          <BiometricOptInDialog
            open={optInOpen}
            email={pendingCreds.email}
            password={pendingCreds.password}
            onClose={(enabled) => {
              if (!enabled) setBiometricDeclined(true)
              setOptInOpen(false)
              setPendingCreds(null)
              const pendingPushRoute = typeof window !== 'undefined' ? sessionStorage.getItem('abia_pending_push_route') : null
              navigate(pendingPushRoute || '/dashboard', { replace: true })
            }}
          />
        ) : null}
      >
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                <CheckCircle2 className="size-3.5" />
                Stable session restore
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300/80">
                <ShieldCheck className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                Encrypted access flow
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300/72">
                Continue to your discussions, private chats, notifications, and community updates.
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:grid-cols-3">
            {TRUST_POINTS.map((point) => (
              <div key={point} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-slate-950/25 p-3">
                <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: MOBILE_BRAND.gold }} />
                <p className="text-xs leading-5 text-slate-300/74">{point}</p>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300/76">
                Email address
              </Label>
              <Input
                id="identifier"
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="email"
                placeholder="name@example.com"
                className="h-14 rounded-2xl border-white/10 bg-slate-950/40 text-white placeholder:text-white/25"
              />
              <p className="text-xs text-slate-400/80">{helperLabel}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300/76">
                  Password
                </Label>
                <Link to="/forgot-password" className="text-xs font-semibold text-slate-100 transition-opacity hover:opacity-80" style={{ color: MOBILE_BRAND.gold }}>
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your secure password"
                  className="h-14 rounded-2xl border-white/10 bg-slate-950/40 pr-12 text-white placeholder:text-white/25"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-4 py-3">
            <label htmlFor="remember" className="flex cursor-pointer items-center gap-3 text-sm text-slate-300/80">
              <Checkbox id="remember" checked={remember} onCheckedChange={(checked) => setRemember(Boolean(checked))} />
              Keep this device ready for faster access
            </label>
            <span className="hidden text-xs text-slate-400 sm:inline">Android-friendly autofill</span>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-16 w-full rounded-2xl text-base font-black text-slate-950 transition-all active:scale-[0.99]"
            style={{ backgroundImage: GOLD_GRADIENT, boxShadow: loading ? 'none' : GOLD_SHADOW }}
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="size-5 rounded-full border-2 border-current border-t-transparent"
                />
                Signing you in…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue to dashboard <ArrowRight className="size-5" />
              </span>
            )}
          </Button>

          <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/35 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Fingerprint className="size-4" style={{ color: MOBILE_BRAND.gold }} />
              Quick unlock on supported devices
            </div>
            <BiometricLoginButton onSuccess={() => navigate('/dashboard', { replace: true })} />
          </div>

          <p className="text-center text-sm text-slate-300/72">
            New here?{' '}
            <Link to="/register" className="font-bold transition-opacity hover:opacity-80" style={{ color: MOBILE_BRAND.gold }}>
              Create your AbiaConnect account
            </Link>
          </p>
        </form>
      </PremiumAuthShell>
    </>
  )
}
