import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Fingerprint, Chrome, Apple, Linkedin, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { Capacitor } from '@capacitor/core'
import { performBiometricAuth, getStoredCredentials, saveCredentials, checkBiometricAvailability } from '@/utils/biometric'

export default function Login() {
  const navigate = useNavigate()
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false)

  useEffect(() => {
    checkBiometricAvailability().then(setIsBiometricAvailable)

    // Check for saved email in localStorage (basic remember me)
    const savedEmail = localStorage.getItem('abia_remembered_email')
    if (savedEmail) setIdentifier(savedEmail)
  }, [])

  async function handleSocialLogin(provider: 'google' | 'apple' | 'linkedin') {
    toast.info(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login initiated...`)
    // Supabase social auth implementation would go here
    // const { error } = await supabase.auth.signInWithOAuth({ provider })
  }

  async function handleBiometricLogin() {
    try {
      const authenticated = await performBiometricAuth()
      if (!authenticated) return

      const creds = await getStoredCredentials()
      if (creds) {
        setLoading(true)
        const { error } = await supabase.auth.signInWithPassword({
          email: creds.username,
          password: creds.password,
        })

        if (error) {
          toast.error('Biometric sign in failed: ' + error.message)
        } else {
          toast.success('Welcome back (via Biometrics)!')
          navigate('/')
        }
        setLoading(false)
      } else {
        toast.error('No credentials saved for biometric login. Please sign in manually once.')
      }
    } catch (err) {
      toast.error('Biometric authentication error')
    }
  }

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

      // If successful and remember me is checked
      if (rememberMe) {
        localStorage.setItem('abia_remembered_email', email)
        if (Capacitor.isNativePlatform()) {
          await saveCredentials(email, password)
        }
      } else {
        localStorage.removeItem('abia_remembered_email')
      }

      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account to join discussions, vote in polls, and connect with Abians worldwide." path="/login" />

      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* 3D-effect Logo Container */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              animate={{
                rotateY: [0, 360],
                scale: [1, 1.05, 1]
              }}
              transition={{
                rotateY: { duration: 10, repeat: Infinity, ease: "linear" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }}
              className="relative w-20 h-20 mb-4"
            >
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative h-full w-full flex items-center justify-center rounded-2xl bg-transparent overflow-hidden">
                <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" onError={(e) => e.currentTarget.src = '/email-logo.png'} />
              </div>
            </motion.div>
            <h1 className="text-3xl font-extrabold tracking-tight">AbiaConnect</h1>
            <p className="text-muted-foreground mt-2">Connecting Abians Worldwide</p>
          </div>

          <div className="bg-card/50 backdrop-blur-xl rounded-3xl border border-border shadow-2xl p-8">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email Address</Label>
                <Input
                  id="identifier"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="h-12 rounded-xl bg-background/50"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary font-medium hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-12 rounded-xl pr-12 bg-background/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label htmlFor="remember" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Remember me
                </label>
              </div>

              <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Sign In <ArrowRight className="size-5" />
                  </div>
                )}
              </Button>

              {isBiometricAvailable && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBiometricLogin}
                  className="w-full h-12 rounded-xl border-dashed gap-2 hover:bg-primary/5 transition-colors"
                >
                  <Fingerprint className="size-5 text-primary" />
                  Sign in with Biometrics
                </Button>
              )}

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Button variant="outline" type="button" onClick={() => handleSocialLogin('google')} className="rounded-xl h-11">
                  <Chrome className="size-5" />
                </Button>
                <Button variant="outline" type="button" onClick={() => handleSocialLogin('apple')} className="rounded-xl h-11">
                  <Apple className="size-5" />
                </Button>
                <Button variant="outline" type="button" onClick={() => handleSocialLogin('linkedin')} className="rounded-xl h-11">
                  <Linkedin className="size-5" />
                </Button>
              </div>

              <p className="text-sm text-center text-muted-foreground pt-2">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary font-bold hover:underline">
                  Join Free
                </Link>
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  )
}
