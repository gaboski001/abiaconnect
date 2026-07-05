import { useEffect, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  getBiometricCredentials,
  isBiometricAvailable,
  isBiometricEnabled,
} from '@/lib/biometric'

interface Props {
  onSuccess: () => void
}

/**
 * Native-only sign-in button. Renders nothing if biometric isn't
 * available on the device or the user hasn't enabled it yet.
 */
export const BiometricLoginButton = ({ onSuccess }: Props) => {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const available = await isBiometricAvailable()
      // Show the button if hardware is available, even if not yet "enabled" in this app.
      if (!cancelled) setShow(available)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!show) return null

  async function handleClick() {
    // If not enabled in-app yet, tell the user exactly what to do.
    if (!isBiometricEnabled()) {
      toast.info('Biometric sign-in isn\'t set up yet', {
        description:
          'Sign in once with your email and password. You\'ll then get a prompt to enable fingerprint or face unlock.',
        duration: 6000,
      })
      return
    }

    setLoading(true)
    try {
      const result = await getBiometricCredentials()
      if (!result.ok) {
        const { kind, message } = result.error
        if (kind === 'cancelled') {
          toast.error('Biometric verification cancelled', { description: message })
        } else if (kind === 'not-enabled' || kind === 'no-credentials') {
          toast.error('Sign in with your password', { description: message, duration: 7000 })
        } else if (kind === 'hardware-unavailable') {
          toast.error('Biometric unavailable', { description: message, duration: 7000 })
        } else if (kind === 'unsupported') {
          toast.error(message)
        } else {
          toast.error('Biometric sign-in failed', { description: message })
        }
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: result.creds.username,
        password: result.creds.password,
      })
      if (error) {
        toast.error('Stored password no longer works', {
          description:
            'Your password changed since biometric was enabled. Sign in with your email and password to reset it.',
          duration: 7000,
        })
        return
      }
      toast.success('Welcome back!')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="h-14 w-full gap-2 rounded-2xl border-white/10 bg-white/[0.03] text-slate-50 hover:bg-white/[0.06]"
    >
      <Fingerprint className="size-4 text-amber-300" />
      {loading ? 'Verifying…' : 'Sign in with biometrics'}
    </Button>
  )
}
