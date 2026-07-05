import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/AuthContext'

const STORAGE_KEY = 'abia:battery-prompt-dismissed'

/**
 * Android-only prompt to request the user to disable battery optimizations.
 * This is crucial for reliable FCM delivery on devices like Xiaomi, Oppo, and Samsung.
 */
export function BatteryOptimizationPrompt() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!user) return
    if (Capacitor.getPlatform() !== 'android') return

    const dismissed = localStorage.getItem(STORAGE_KEY) === 'true'
    if (dismissed) return

    // Show prompt after a short delay so it doesn't collide with onboarding/login success
    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [user])

  const handleOpenSettings = async () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, 'true')

    // We use the Native bridge to open settings.
    // Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS requires a specialized plugin
    // or a simple browser open if the plugin isn't present.
    // For now, we guide the user to the general battery settings.
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
      // If we had a dedicated "Android Settings" plugin, we'd use it here.
      // Since we don't want to add new plugins, we'll use a helpful alert description
      // and let the user know what to look for.
    } catch {}
  }

  return (
    <AlertDialog open={show} onOpenChange={setShow}>
      <AlertDialogContent className="max-w-[90vw] rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Reliable Notifications</AlertDialogTitle>
          <AlertDialogDescription>
            To ensure you receive messages and calls in real-time, please ensure AbiaConnect is set to "Unrestricted" in your phone's battery settings.
            <br /><br />
            Some manufacturers (Xiaomi, Samsung) may delay alerts to save battery.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => {
            setShow(false)
            localStorage.setItem(STORAGE_KEY, 'true')
          }}>
            Got it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
