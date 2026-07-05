import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Fingerprint, KeyRound, RotateCcw, ShieldAlert } from 'lucide-react'
import type { BiometricError } from '@/lib/biometric'

interface Props {
  open: boolean
  error: BiometricError | null
  busy?: boolean
  onRetry: () => void
  onUsePassword: () => void
  onReEnable: () => void
  onClose: () => void
}

/**
 * Guided recovery dialog shown when biometric sign-in fails. Presents the
 * user with three next steps in one place: retry the biometric prompt,
 * re-enable biometric via password sign-in, or just sign in with password.
 */
export function BiometricRecoveryDialog({
  open,
  error,
  busy = false,
  onRetry,
  onUsePassword,
  onReEnable,
  onClose,
}: Props) {
  const kind = error?.kind ?? 'unknown'

  // "Retry" only makes sense when biometric is still set up on this device.
  const canRetry = kind === 'cancelled' || kind === 'unknown'
  // "Re-enable" is the right action when the keystore entry is gone or
  // the stored password no longer works.
  const needsReEnable = kind === 'no-credentials' || kind === 'not-enabled'

  const title =
    kind === 'cancelled' ? 'Biometric cancelled'
    : kind === 'hardware-unavailable' ? 'Biometric unavailable'
    : kind === 'no-credentials' ? 'Saved sign-in missing'
    : kind === 'not-enabled' ? 'Biometric not set up yet'
    : kind === 'unsupported' ? 'Not supported on the web'
    : 'Biometric sign-in failed'

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive mb-2">
            <ShieldAlert className="size-7" />
          </div>
          <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {error?.message ?? 'Something went wrong. Choose how you\'d like to continue.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 pt-2">
          {canRetry && (
            <Button
              onClick={onRetry}
              disabled={busy}
              className="w-full h-11"
            >
              <Fingerprint className="mr-2 size-4" />
              {busy ? 'Trying…' : 'Try biometric again'}
            </Button>
          )}

          {needsReEnable && (
            <Button
              onClick={onReEnable}
              disabled={busy}
              className="w-full h-11"
            >
              <RotateCcw className="mr-2 size-4" />
              Re-enable biometric with password
            </Button>
          )}

          <Button
            onClick={onUsePassword}
            variant="outline"
            disabled={busy}
            className="w-full h-11"
          >
            <KeyRound className="mr-2 size-4" />
            Sign in with email &amp; password
          </Button>
        </div>

        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel onClick={onClose} disabled={busy} className="w-full">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
