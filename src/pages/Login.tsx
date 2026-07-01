import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SEO } from '@/components/SEO'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { NativeAuthLayout, isNativeApp } from '@/components/mobile/NativeAuthLayout'

export default function Login() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

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
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  if (isNativeApp()) {
    return (
      <>
        <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account." path="/login" />
        <NativeAuthLayout
          title="Welcome back"
          subtitle="Sign in to continue to AbiaConnect"
          logoUrl={logoUrl}
          siteName={settings.site_name || 'AbiaConnect'}
        >
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier-native" className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300/80">Email</Label>
              <Input
                id="identifier-native"
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="email"
                className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password-native" className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300/80">Password</Label>
                <Link to="/forgot-password" className="text-xs text-amber-300 hover:underline">Forgot?</Link>
              </div>
              <div className="relative">
                <Input
                  id="password-native"
                  type={show ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 rounded-2xl border-white/10 bg-white/[0.04] text-white pr-10 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl text-base font-bold text-[#0B1F0B]"
              style={{ backgroundImage: 'linear-gradient(135deg,#F8C301 0%,#E87015 100%)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
            <p className="pt-1 text-center text-sm text-slate-300/80">
              New here?{' '}
              <Link to="/register" className="font-semibold text-amber-300 hover:underline">Create account</Link>
            </p>
          </form>
        </NativeAuthLayout>
        {/* Admin fast path retained */}
        {isAdmin ? null : null}
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
