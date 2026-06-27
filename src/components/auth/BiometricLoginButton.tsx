import { useEffect, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
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
      if (!cancelled) setShow(available && isBiometricEnabled())
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!show) return null

  async function handleClick() {
    setLoading(true)
    try {
      const creds = await getBiometricCredentials()
      if (!creds) {
        toast.error('Biometric verification cancelled')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.username,
        password: creds.password,
      })
      if (error) {
        toast.error('Stored credentials no longer work. Please sign in with your password.')
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
