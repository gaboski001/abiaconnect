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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return
    if (!getPromptEnabled()) return

    // Always allow click on Android/iOS (we have an in-app fallback modal).
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

  const handleInstall = async () => {
    void logPwaEvent('manual_click')
    const deferred = getDeferredPrompt()
    if (deferred) {
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
      return
    }

    if (isIOS()) {
      void logPwaEvent('ios_help_shown')
      setShowIOSHelp(true)
      return
    }

    if (/android/i.test(navigator.userAgent)) {
      setShowAndroidHelp(true)
      return
    }

    toast.info(
      'Your browser will offer the install option when ready. Try visiting the site a few more times.',
      { duration: 6000 }
    )
  }

  if (!canInstall && !showAlways) return null

  const Icon = label.toLowerCase().includes('download') ? Download : Smartphone

  return (
    <>
      <Button variant={variant} size="sm" onClick={handleInstall}>
        <Icon className="size-4 mr-2" />
        {label}
      </Button>
      <IOSInstallHelpModal open={showIOSHelp} onOpenChange={setShowIOSHelp} />
      <AndroidInstallHelpModal open={showAndroidHelp} onOpenChange={setShowAndroidHelp} />
    </>
  )
}
