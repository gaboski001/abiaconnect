import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Smartphone, X, Share, PlusSquare, Menu } from 'lucide-react'
import { NativeAppDownload } from './NativeAppDownload'

const DISMISS_KEY = 'abia:install-prompt-dismissed-at'
const SHOW_DELAY_MS = 4000
// Re-prompt at most once per 7 days after dismissal.
const REPROMPT_AFTER_MS = 7 * 24 * 60 * 60 * 1000

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(mq || iosStandalone)
}

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop'
  const ua = window.navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  if (isIOS) {
    // Safari = no CriOS/FxiOS/EdgiOS. In-app browsers (FB, IG) cannot install.
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|Line/i.test(ua)
    return isSafari ? 'ios-safari' : 'ios-other'
  }
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

export function InstallAppPrompt() {
  const [open, setOpen] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const platform = useMemo(detectPlatform, [])

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

  const isIOSSafari = platform === 'ios-safari'
  const isIOSOther = platform === 'ios-other'

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <img src="/icons/icon-192x192.png" alt="AbiaConnect" className="h-10 w-10 rounded-xl" />
          </div>
          <DialogTitle className="text-center">Install AbiaConnect</DialogTitle>
          <DialogDescription className="text-center">
            Add AbiaConnect to your home screen for faster access, a fullscreen app feel, and instant launches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isIOSSafari && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" /> Install on iPhone / iPad
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">1</span>
                  <span className="flex-1">
                    Tap the <Share className="inline h-4 w-4 align-text-bottom text-primary" /> <strong>Share</strong> button at the bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">2</span>
                  <span className="flex-1">
                    Scroll and tap <PlusSquare className="inline h-4 w-4 align-text-bottom text-primary" /> <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">3</span>
                  <span className="flex-1">Tap <strong>Add</strong> — the AbiaConnect icon appears on your home screen.</span>
                </li>
              </ol>
            </div>
          )}

          {isIOSOther && (
            <div className="rounded-lg border bg-amber-500/10 p-3 text-sm">
              <p className="font-medium mb-1">Open in Safari to install</p>
              <p className="text-muted-foreground">
                iPhone can only add this app to your home screen from <strong>Safari</strong>. Tap the menu and choose
                "Open in Safari", then return here.
              </p>
            </div>
          )}

          {deferred && !isIOSSafari && !isIOSOther && (
            <Button onClick={install} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Install app
            </Button>
          )}

          {platform === 'android' && !deferred && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium flex items-center gap-2">
                <Menu className="h-4 w-4 text-primary" /> Install on Android
              </p>
              <p className="text-muted-foreground">
                Tap your browser's menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
            </div>
          )}

          <div className="rounded-lg border p-3">
            <NativeAppDownload />
          </div>
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
