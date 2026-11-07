import { useState } from 'react'
import { Fingerprint, Lock, ShieldCheck, ToggleRight } from 'lucide-react'
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
import { APP_HEADER_GRADIENT } from '@/lib/mobileBrand'

interface Props {
  open: boolean
  email: string
  password: string
  onClose: (enabled: boolean) => void
}

const POINTS = [
  { icon: Lock, text: 'Your sign-in stays locked on this phone only.' },
  { icon: ShieldCheck, text: 'We never see your fingerprint or face.' },
  { icon: ToggleRight, text: 'Turn it off any time in Settings.' },
]

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
        toast.success('Fingerprint or face sign-in is on')
        onClose(true)
      } else {
        toast.error('Could not turn on fingerprint or face sign-in')
        onClose(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !busy && onClose(false)}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-[28px] border-0 p-0">
        <div className="px-6 pb-6 pt-7 text-center text-white" style={{ background: APP_HEADER_GRADIENT }}>
          <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 to-orange-500 text-black shadow-lg">
            <Fingerprint className="size-9" />
          </div>
          <AlertDialogHeader className="mt-4 space-y-1.5">
            <AlertDialogTitle className="text-center text-2xl font-extrabold text-white">
              Sign in with one touch
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-[15px] text-white/85">
              Use your fingerprint or face next time, instead of typing your password.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <ul className="space-y-3.5 px-6 pt-5 text-[15px] text-foreground">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Icon className="size-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <AlertDialogFooter className="flex-col gap-2 p-6 sm:flex-col sm:space-x-0">
          <AlertDialogAction onClick={handleEnable} disabled={busy} className="h-13 w-full rounded-full text-base font-bold">
            {busy ? 'Turning on…' : 'Turn on'}
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={() => onClose(false)}
            disabled={busy}
            className="mt-0 h-12 w-full rounded-full border-0 bg-transparent text-base shadow-none"
          >
            Not now
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
