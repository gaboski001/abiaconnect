import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { SEO } from '@/components/SEO'

export default function Login() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  async function resolveEmail(value: string): Promise<string | null> {
    if (value.includes('@')) return value
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', value)
      .maybeSingle()
    return (data as { email?: string } | null)?.email ?? null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const email = await resolveEmail(identifier.trim())
      if (!email) {
        toast.error('No account found with that username or email.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Welcome back!')
      navigate(isAdmin ? '/admin/dashboard' : '/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO title="Sign in to AbiaConnect" description="Sign in to your AbiaConnect account to join discussions, vote in polls, and connect with Abians worldwide." path="/login" />
    <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 rounded-3xl p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
            <Zap className="size-6" />
          </span>
          <h1 className="text-2xl font-bold">Sign in to AbiaConnect</h1>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to continue to AbiaConnect
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or Username</Label>
            <Input
              id="identifier"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
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
