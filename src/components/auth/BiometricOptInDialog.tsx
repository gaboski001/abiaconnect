import { useState } from 'react'
import { Fingerprint, Lock, ShieldCheck, X } from 'lucide-react'
import { toast } from '@/lib/toast'
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
import { enableBiometric } from '@/lib/biometric'

interface Props {
  open: boolean
  email: string
  password: string
  onClose: (enabled: boolean) => void
}

/**
 * Native-only opt-in dialog. Explains exactly how biometrics will be used
 * BEFORE invoking the system prompt, then securely stores credentials in
 * the device keystore via `enableBiometric`.
 */
export function BiometricOptInDialog({ open, email, password, onClose }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleEnable() {
    setBusy(true)
    try {
      const ok = await enableBiometric(email, password)
      if (ok) {
        toast.success('Biometric sign-in enabled')
        onClose(true)
      } else {
        toast.error('Could not enable biometric sign-in')
        onClose(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !busy && onClose(false)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground mb-2">
            <Fingerprint className="size-7" />
          </div>
          <AlertDialogTitle className="text-center">
            Enable biometric sign-in?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Skip typing your password next time — unlock AbiaConnect with your
            fingerprint or face.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-3 my-2 text-sm">
          <li className="flex gap-3">
            <Lock className="size-5 text-primary shrink-0 mt-0.5" />
            <span>
              Your email and password are stored only on this device, inside
              the secure keystore (Android Keystore / iOS Keychain).
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
            <span>
              AbiaConnect never sees your biometric data — the device verifies
              you and unlocks the saved credentials.
            </span>
          </li>
          <li className="flex gap-3">
            <X className="size-5 text-primary shrink-0 mt-0.5" />
            <span>
              You can turn this off anytime in Settings, or by signing out.
            </span>
          </li>
        </ul>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            onClick={handleEnable}
            disabled={busy}
            className="w-full"
          >
            {busy ? 'Enabling…' : 'Enable biometric sign-in'}
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={() => onClose(false)}
            disabled={busy}
            className="w-full mt-0"
          >
            Not now
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
