import { useEffect, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  disableBiometric,
  getBiometricCredentials,
  isBiometricAvailable,
  isBiometricEnabled,
  type BiometricError,
} from '@/lib/biometric'
import { BiometricRecoveryDialog } from '@/components/auth/BiometricRecoveryDialog'

interface Props {
  onSuccess: () => void
  /**
   * Called when the user picks "Sign in with email & password" or
   * "Re-enable biometric with password" from the recovery dialog. Login
   * uses this to focus the email field so the user doesn't have to hunt
   * for it.
   */
  onFallbackToPassword?: (opts: { reEnable: boolean }) => void
}

/**
 * Native-only sign-in button. Renders nothing if biometric hardware isn't
 * available. On failure it opens a guided recovery dialog with retry /
 * re-enable / use-password actions.
 */
export const BiometricLoginButton = ({ onSuccess, onFallbackToPassword }: Props) => {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [lastError, setLastError] = useState<BiometricError | null>(null)

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

  async function attemptBiometric() {
    setLoading(true)
    try {
      const result = await getBiometricCredentials()
      if (!result.ok) {
        setLastError(result.error)
        setRecoveryOpen(true)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: result.creds.username,
        password: result.creds.password,
      })
      if (error) {
        setLastError({
          kind: 'no-credentials',
          message:
            'Your password changed since biometric was enabled. Sign in with your email and password to reset it.',
        })
        setRecoveryOpen(true)
        return
      }
      toast.success('Welcome back!')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  async function handleClick() {
    if (!isBiometricEnabled()) {
      setLastError({
        kind: 'not-enabled',
        message:
          'Biometric sign-in isn\'t set up yet on this device. Sign in once with your email and password to enable it.',
      })
      setRecoveryOpen(true)
      return
    }
    await attemptBiometric()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        className="h-[52px] w-full gap-2.5 rounded-xl border-white/12 bg-white/[0.04] text-[15px] font-semibold text-slate-50 hover:bg-white/[0.07]"
      >
        <Fingerprint className="size-5 text-amber-300" />
        {loading ? 'Verifying…' : 'Sign in with biometrics'}
      </Button>

      <BiometricRecoveryDialog
        open={recoveryOpen}
        error={lastError}
        busy={loading}
        onRetry={() => {
          setRecoveryOpen(false)
          void attemptBiometric()
        }}
        onUsePassword={() => {
          setRecoveryOpen(false)
          onFallbackToPassword?.({ reEnable: false })
        }}
        onReEnable={async () => {
          // Wipe the stale keystore entry + enabled flag so the next
          // successful password sign-in re-triggers the opt-in dialog.
          await disableBiometric()
          setRecoveryOpen(false)
          toast.info('Sign in with your password to re-enable biometric.')
          onFallbackToPassword?.({ reEnable: true })
        }}
        onClose={() => setRecoveryOpen(false)}
      />
    </>
  )
}
