import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

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
  )
}
