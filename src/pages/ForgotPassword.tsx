import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Zap, ArrowLeft } from 'lucide-react'
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

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0D0D0D] overflow-y-auto font-sans">
      <SEO title="Reset your AbiaConnect password" description="Request a password reset link." path="/forgot-password" />

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
            <Zap className="size-10" style={{ color: BRAND.gold }} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2 text-center px-4">Account Recovery</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#161616] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl"
        >
          {sent ? (
            <div className="text-center space-y-6">
              <div className="size-16 rounded-full flex items-center justify-center mx-auto" style={{ background: `${BRAND.gold}20` }}>
                <CheckCircle2 className="size-8" style={{ color: BRAND.gold }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
                <p className="text-sm leading-relaxed" style={{ color: BRAND.textMuted }}>
                  We've sent a recovery link to <strong>{email}</strong>. Please check your inbox and spam folder.
                </p>
              </div>
              <Button asChild className="w-full h-14 rounded-xl font-bold" style={{ background: BRAND.gold, color: BRAND.bg }}>
                <Link to="/login">Back to Sign In</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest ml-1 opacity-50">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-14 rounded-2xl border-white/5 bg-[#0D0D0D] text-white"
                />
                <p className="text-[10px] ml-1" style={{ color: BRAND.textMuted }}>
                  Enter the email associated with your AbiaConnect account.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl text-base font-bold"
                style={{ background: BRAND.gold, color: BRAND.bg }}
              >
                {loading ? 'Sending Recovery Link...' : 'Send Recovery Link'}
              </Button>

              <Button variant="ghost" asChild className="w-full text-white/40 hover:text-white">
                <Link to="/login"><ArrowLeft className="mr-2 size-4" /> Cancel and go back</Link>
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
