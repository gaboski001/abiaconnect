import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { AuthField, AuthSubmit, NativeAuthLayout, isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { BiometricLoginButton } from '@/components/auth/BiometricLoginButton'
import { BiometricOptInDialog } from '@/components/auth/BiometricOptInDialog'
import {
  isBiometricAvailable,
  isBiometricEnabled,
  hasDeclinedBiometric,
  setBiometricDeclined,
} from '@/lib/biometric'

export default function Login() {
  const navigate = useNavigate()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optInOpen, setOptInOpen] = useState(false)
  const [optInEmail, setOptInEmail] = useState('')
  const [optInPassword, setOptInPassword] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const email = identifier.trim()
      if (!email.includes('@')) {
        toast.error('Please sign in with your email address.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Welcome back!')

      // Offer biometric opt-in on native devices where hardware is available
      // and the user hasn't already enabled or explicitly declined it.
      if (
        isNativeApp() &&
        !isBiometricEnabled() &&
        !hasDeclinedBiometric() &&
        (await isBiometricAvailable())
      ) {
        setOptInEmail(email)
        setOptInPassword(password)
        setOptInOpen(true)
        return // wait for opt-in dialog to close before navigating
      }

      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  function handleOptInClose(_enabled: boolean) {
    // Whether they enabled or skipped, don't badger them again this session.
    if (!_enabled) setBiometricDeclined(true)
    setOptInOpen(false)
    setOptInEmail('')
    setOptInPassword('')
    navigate('/')
  }

  if (isNativeApp()) {
    return (
      <>
        <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account." path="/login" />
        <NativeAuthLayout
          title="Welcome back"
          subtitle="Sign in to continue to your community."
          siteName={settings.site_name || 'AbiaConnect'}
          backTo="/"
          footer={
            <>
              New to AbiaConnect?{' '}
              <Link to="/register" className="font-semibold text-amber-300">Create an account</Link>
            </>
          }
        >
          <form onSubmit={onSubmit} className="space-y-5">
            <AuthField
              id="identifier-native"
              label="Email address"
              icon={Mail}
              type="email"
              inputMode="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
            <AuthField
              id="password-native"
              label="Password"
              icon={Lock}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              labelAction={
                <Link to="/forgot-password" className="text-[13px] font-semibold text-amber-300">
                  Forgot password?
                </Link>
              }
            />
            <div className="pt-1">
              <AuthSubmit loading={loading} loadingText="Signing in…">Sign in</AuthSubmit>
            </div>

            <div className="flex items-center gap-3 py-1" aria-hidden>
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400/80">or</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <BiometricLoginButton
              onSuccess={() => navigate('/')}
              onFallbackToPassword={() => {
                // Focus the email field so the user can immediately type
                // credentials — this is what makes the recovery flow feel
                // "in one place".
                setTimeout(() => {
                  const el = document.getElementById('identifier-native') as HTMLInputElement | null
                  el?.focus()
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 50)
              }}
            />
          </form>
        </NativeAuthLayout>
        <BiometricOptInDialog
          open={optInOpen}
          email={optInEmail}
          password={optInPassword}
          onClose={handleOptInClose}
        />
      </>
    )
  }

  return (
    <>
      <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account to join discussions, vote in polls, and connect with Abians worldwide." path="/login" />
    <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 rounded-3xl p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={settings.site_name || 'AbiaConnect'} className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold">{(settings.site_name || 'A').charAt(0)}</span>
            )}
          </span>
          <h1 className="text-2xl font-bold">Sign in to AbiaConnect</h1>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to continue to AbiaConnect
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email</Label>
            <Input
              id="identifier"
              type="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
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
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            New here?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Join Free
            </Link>
          </p>
        </form>
      </div>
    </div>
    </>
  )
}
