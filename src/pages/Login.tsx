import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SEO } from '@/components/SEO'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { BiometricLoginButton } from '@/components/auth/BiometricLoginButton'
import { BiometricOptInDialog } from '@/components/auth/BiometricOptInDialog'
import { motion } from 'framer-motion'
import {
  hasDeclinedBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricDeclined,
} from '@/lib/biometric'

const BRAND = {
  bg: '#0D0D0D',
  surface: '#1E1E1E',
  gold: '#C8A951',
  goldDark: '#8A7A3A',
  text: '#FFFFFF',
  textMuted: '#B0B0B0',
};

export default function Login() {
  const navigate = useNavigate()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [optInOpen, setOptInOpen] = useState(false)
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return;

    setLoading(true)

    // Safety timeout: reset loading state if no response in 15 seconds
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        toast.error('Connection timed out. Please check your internet and try again.');
      }
    }, 15000);

    try {
      const email = identifier.trim()
      if (!email.includes('@')) {
        toast.error('Please sign in with your email address.')
        clearTimeout(timeout);
        setLoading(false);
        return
      }

      console.log('Attempting sign in for:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      clearTimeout(timeout);

      if (error) {
        console.error('Sign in error:', error);
        toast.error(error.message)
        setLoading(false);
        return
      }

      toast.success('Welcome back!')

      // Biometric check
      try {
        if (!isBiometricEnabled() && !hasDeclinedBiometric() && (await isBiometricAvailable())) {
          setPendingCreds({ email, password })
          setOptInOpen(true)
          setLoading(false);
          return
        }
      } catch (bioErr) {
        console.warn('Biometric check failed:', bioErr);
      }

      navigate('/')
    } catch (err) {
      clearTimeout(timeout);
      console.error('Login exception:', err);
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0D0D0D] overflow-y-auto font-sans">
      <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account." path="/login" />

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: BRAND.gold }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: BRAND.gold }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full px-6 py-12 min-h-full">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-20 h-20 mb-6 flex items-center justify-center rounded-2xl bg-[#1E1E1E] border border-white/5 shadow-2xl">
            {logoUrl ? (
              <img src={logoUrl} alt="AbiaConnect" className="w-14 h-14 object-contain" />
            ) : (
              <span className="text-3xl font-bold" style={{ color: BRAND.gold }}>A</span>
            )}
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">AbiaConnect</h1>
          <p className="text-base font-medium" style={{ color: BRAND.textMuted }}>Connecting Abians Worldwide</p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md bg-[#161616] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-black/50"
        >
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-bold uppercase tracking-widest ml-1" style={{ color: BRAND.textMuted }}>
                Email Address
              </Label>
              <Input
                id="identifier"
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="email"
                placeholder="name@example.com"
                className="h-14 rounded-2xl border-white/5 bg-[#0D0D0D] text-white placeholder:text-white/20 focus:ring-BRAND.gold/50"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.textMuted }}>
                  Password
                </Label>
                <Link to="/forgot-password" size="sm" className="text-xs font-bold" style={{ color: BRAND.gold }}>
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
                  placeholder="••••••••"
                  className="h-14 rounded-2xl border-white/5 bg-[#0D0D0D] text-white placeholder:text-white/20 pr-12 focus:ring-BRAND.gold/50"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3 ml-1 py-1">
              <Checkbox id="remember" className="rounded-md border-white/10 data-[state=checked]:bg-BRAND.gold data-[state=checked]:border-BRAND.gold" />
              <Label htmlFor="remember" className="text-sm font-medium cursor-pointer" style={{ color: BRAND.textMuted }}>
                Remember me
              </Label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-16 rounded-2xl text-lg font-bold group relative overflow-hidden active:scale-[0.98] transition-transform"
              style={{
                background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
                color: BRAND.bg,
                boxShadow: `0 8px 30px -5px ${BRAND.gold}60`,
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">Signing in...</span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>

            {/* Social Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-tighter">
                <span className="bg-[#161616] px-4 text-white/20 font-bold">Or continue with</span>
              </div>
            </div>

            {/* Biometric & Links */}
            <div className="space-y-4">
              <BiometricLoginButton onSuccess={() => navigate('/')} />

              <p className="text-sm text-center font-medium" style={{ color: BRAND.textMuted }}>
                Don't have an account?{' '}
                <Link to="/register" className="font-bold hover:underline" style={{ color: BRAND.gold }}>
                  Join Free
                </Link>
              </p>
            </div>
          </form>
        </motion.div>

        {/* Auth Dialogs */}
        {pendingCreds && (
          <BiometricOptInDialog
            open={optInOpen}
            email={pendingCreds.email}
            password={pendingCreds.password}
            onClose={(enabled) => {
              if (!enabled) setBiometricDeclined(true)
              setOptInOpen(false)
              setPendingCreds(null)
              navigate('/')
            }}
          />
        )}
      </div>
    </div>
  )
}
