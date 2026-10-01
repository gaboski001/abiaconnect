import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Mail, MailCheck, Zap } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { SEO } from '@/components/SEO'
import { AuthField, AuthSubmit, NativeAuthLayout, isNativeApp } from '@/components/mobile/NativeAuthLayout'

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

  if (isNativeApp()) {
    return (
      <>
        <SEO title="Reset your AbiaConnect password" description="Request a password reset link for your AbiaConnect account." path="/forgot-password" />
        <NativeAuthLayout
          title={sent ? 'Check your email' : 'Reset your password'}
          subtitle={
            sent
              ? 'Follow the link we sent to choose a new password.'
              : "Enter the email you signed up with and we'll send you a secure reset link."
          }
          backTo="/login"
          footer={
            <>
              Remembered it?{' '}
              <Link to="/login" className="font-semibold text-amber-300">Back to sign in</Link>
            </>
          }
        >
          {sent ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
                  <MailCheck className="size-5 text-emerald-300" />
                </span>
                <p className="text-[15px] leading-6 text-slate-300">
                  If an account exists for <span className="font-semibold text-white">{email}</span>, a reset link is on its
                  way. Check your spam folder if it doesn't arrive in a few minutes.
                </p>
              </div>
              <Link
                to="/login"
                className="flex h-[52px] w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-[15px] font-semibold text-white"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <AuthField
                label="Email address"
                icon={Mail}
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <AuthSubmit loading={loading} loadingText="Sending…">Send reset link</AuthSubmit>
            </form>
          )}
        </NativeAuthLayout>
      </>
    )
  }

  return (
    <>
      <SEO title="Reset your AbiaConnect password" description="Request a password reset link for your AbiaConnect account." path="/forgot-password" />
    <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 rounded-3xl p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
            <Zap className="size-6" />
          </span>
          <h1 className="text-2xl font-bold">Reset Your Password</h1>
          <p className="text-sm text-muted-foreground text-center">
            We'll email you a secure link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="size-12 mx-auto text-primary" />
            <p className="text-sm">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
              Check your inbox (and spam folder).
            </p>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/login">Back to Sign In</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Remembered it?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
    </>
  )
}
