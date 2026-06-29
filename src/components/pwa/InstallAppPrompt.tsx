import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Smartphone, X } from 'lucide-react'
import { NativeAppDownload } from './NativeAppDownload'

const DISMISS_KEY = 'abia:install-prompt-dismissed-at'
const SHOW_DELAY_MS = 4000
// Re-prompt at most once per 7 days after dismissal.
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)').matches
  // iOS Safari
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(mq || iosStandalone)
}

export function InstallAppPrompt() {
  const [open, setOpen] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (Capacitor.isNativePlatform()) return
    if (isStandalone()) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < REPROMPT_AFTER_MS) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const t = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setOpen(false)
  }

  const install = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      await deferred.userChoice
    } finally {
      setDeferred(null)
      dismiss()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Install AbiaConnect</DialogTitle>
          <DialogDescription className="text-center">
            Get the full app experience — faster load, push notifications, and a home-screen icon.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {deferred && (
            <Button onClick={install} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Install web app
            </Button>
          )}
          <div className="rounded-lg border p-3">
            <NativeAppDownload />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            On iPhone: tap Share → Add to Home Screen. On Android: use your browser menu → Install app.
          </p>
        </div>

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

export default InstallAppPrompt
