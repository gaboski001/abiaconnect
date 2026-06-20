import { useEffect, useRef, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IOSInstallHelpModal } from './IOSInstallHelpModal'
import { AndroidInstallHelpModal } from './AndroidInstallHelpModal'
import {
  getDeferredPrompt,
  setDeferredPrompt,
  isIOS,
  isStandalone,
  getPromptEnabled,
  logPwaEvent,
  type BIPEvent,
} from '@/lib/pwaInstall'

interface PWAInstallButtonProps {
  showAlways?: boolean
  variant?: 'default' | 'outline'
  label?: string
}

export function PWAInstallButton({
  showAlways = false,
  variant = 'outline',
  label = 'Install App',
}: PWAInstallButtonProps) {
  const [canInstall, setCanInstall] = useState(false)
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [showAndroidHelp, setShowAndroidHelp] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const attempts = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return
    if (!getPromptEnabled()) return

    const ua = navigator.userAgent
    const isMobile = isIOS() || /android/i.test(ua)
    if (isMobile || getDeferredPrompt()) {
      setCanInstall(true)
    }

    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BIPEvent)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  const firePrompt = async (deferred: BIPEvent) => {
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') {
        void logPwaEvent('accepted')
        toast.success('AbiaConnect installed successfully!', { duration: 3000 })
      } else {
        void logPwaEvent('dismissed')
      }
    } catch {
      toast.error('Install prompt failed. Please try again.')
    }
    setDeferredPrompt(null)
  }

  const showFallback = () => {
    if (isIOS()) {
      void logPwaEvent('ios_help_shown')
      setShowIOSHelp(true)
    } else if (/android/i.test(navigator.userAgent)) {
      setShowAndroidHelp(true)
    } else {
      toast.info(
        'Your browser will offer the install option when ready. Try visiting the site a few more times.',
        { duration: 6000 }
      )
    }
  }

  const handleInstall = async () => {
    void logPwaEvent('manual_click')
    attempts.current += 1

    const deferred = getDeferredPrompt()
    if (deferred) {
      await firePrompt(deferred)
      attempts.current = 0
      return
    }

    // First tap with no prompt: wait briefly for one to arrive.
    if (attempts.current === 1 && !isIOS()) {
      setWaiting(true)
      const t = toast.loading('Preparing install…', { duration: 2500 })
      const got = await new Promise<BIPEvent | null>((resolve) => {
        const onBIP = (e: Event) => {
          e.preventDefault()
          const ev = e as BIPEvent
          setDeferredPrompt(ev)
          resolve(ev)
        }
        window.addEventListener('beforeinstallprompt', onBIP, { once: true })
        window.setTimeout(() => {
          window.removeEventListener('beforeinstallprompt', onBIP)
          resolve(getDeferredPrompt())
        }, 2000)
      })
      toast.dismiss(t)
      setWaiting(false)
      if (got) {
        await firePrompt(got)
        attempts.current = 0
        return
      }
      toast.message('Install prompt unavailable — tap again for manual steps.')
      return
    }

    // Second tap (or iOS): show the best fallback.
    showFallback()
  }


  if (!canInstall && !showAlways) return null

  const Icon = label.toLowerCase().includes('download') ? Download : Smartphone

  return (
    <>
      <Button variant={variant} size="sm" onClick={handleInstall} disabled={waiting}>
        <Icon className="size-4 mr-2" />
        {waiting ? 'Preparing…' : label}
      </Button>
      <IOSInstallHelpModal open={showIOSHelp} onOpenChange={setShowIOSHelp} />
      <AndroidInstallHelpModal open={showAndroidHelp} onOpenChange={setShowAndroidHelp} />
    </>
  )
}
