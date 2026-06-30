import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Share, Plus, Smartphone, X } from 'lucide-react'

const DEVICE_KEY = 'abia:ios-install-device-id'
const DISMISS_KEY = 'abia:ios-install-dismissed-at'
const ACCEPTED_KEY = 'abia:ios-install-accepted'
const SHOW_DELAY_MS = 3000
// Re-prompt once per 14 days after dismissal on the same browser/device.
const REPROMPT_AFTER_MS = 14 * 24 * 60 * 60 * 1000

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOSClassic = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ reports as Mac; detect via touch points.
  const iPadOS =
    ua.includes('Macintosh') &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  return iOSClassic || iPadOS
}

/**
 * Only Safari on iOS can "Add to Home Screen". Chrome/Firefox/Edge/Opera on iOS
 * (CriOS/FxiOS/EdgiOS/OPiOS) all use WebKit under the hood but cannot install
 * PWAs — showing them the Safari Share-sheet instructions would be misleading.
 */
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  if (!isIOS()) return false
  const ua = navigator.userAgent || ''
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|YaBrowser|DuckDuckGo/i.test(ua)
  const hasSafari = /Safari/.test(ua)
  return hasSafari && !isOtherIOSBrowser
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(mq || iosStandalone)
}

/**
 * iOS-only "Add to Home Screen" prompt.
 *
 * Triggers when a brand-new iOS browser/device opens the site (no fingerprint
 * stored yet), or 14 days after the last dismissal. iOS Safari does not fire
 * `beforeinstallprompt`, so we render a manual instructional modal instead.
 */
export function IOSInstallPrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (Capacitor.isNativePlatform()) return
    if (!isIOSSafari()) return
    if (isStandalone()) {
      // Already installed → persist the accepted flag so we never prompt again.
      localStorage.setItem(ACCEPTED_KEY, '1')
      return
    }
    // User previously accepted/installed on this device.
    if (localStorage.getItem(ACCEPTED_KEY) === '1') return

    const existingDevice = localStorage.getItem(DEVICE_KEY)
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    const recentlyDismissed =
      dismissedAt && Date.now() - dismissedAt < REPROMPT_AFTER_MS

    if (existingDevice && recentlyDismissed) return

    if (!existingDevice) {
      localStorage.setItem(DEVICE_KEY, crypto.randomUUID())
    }

    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setOpen(false)
  }

  const accept = () => {
    // Persist permanently — the user confirmed they're installing.
    localStorage.setItem(ACCEPTED_KEY, '1')
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Install AbiaConnect on your iPhone</DialogTitle>
          <DialogDescription className="text-center">
            Add AbiaConnect to your Home Screen for a faster, full-screen experience
            with notifications.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              1
            </span>
            <span className="flex items-center gap-1.5">
              Tap the <Share className="inline h-4 w-4 text-primary" />
              <strong>Share</strong> button in Safari's toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              2
            </span>
            <span className="flex items-center gap-1.5">
              Scroll and choose <Plus className="inline h-4 w-4 text-primary" />
              <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              3
            </span>
            <span>
              Tap <strong>Add</strong> — the AbiaConnect icon will appear on your Home Screen.
            </span>
          </li>
        </ol>

        <p className="text-xs text-center text-muted-foreground">
          Make sure you're using <strong>Safari</strong>. Other iOS browsers can't install web apps.
        </p>

        <Button onClick={dismiss} variant="outline" className="w-full">
          Got it
        </Button>

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  )
}

export default IOSInstallPrompt
