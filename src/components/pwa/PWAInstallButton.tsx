import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  getDeferredPrompt,
  setDeferredPrompt,
  isIOS,
  isStandalone,
  getPromptEnabled,
  logPwaEvent,
  type BIPEvent,
} from '@/lib/pwaInstall'

export function PWAInstallButton() {
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return

    // Show if iOS or if we already captured a deferred prompt.
    const ios = isIOS()
    if (ios || getDeferredPrompt()) {
      setCanInstall(true)
      return
    }

    // Otherwise listen for the beforeinstallprompt event.
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
          toast.success('AbiaConnect installed successfully!', { duration: 3000 })
        }
      } catch {
        toast.error('Install prompt failed. Please try again.')
      }
      setDeferredPrompt(null)
      return
    }

    if (isIOS()) {
      toast.info(
        'Tap the Share button in Safari, then select "Add to Home Screen".',
        { duration: 6000 }
      )
      return
    }

    toast.info(
      'Your browser will offer the install option when ready. Try visiting the site a few more times.',
      { duration: 5000 }
    )
  }

  if (!canInstall) return null

  return (
    <Button variant="outline" size="sm" onClick={handleInstall}>
      <Smartphone className="size-4 mr-2" />
      Install App
    </Button>
  )
}
