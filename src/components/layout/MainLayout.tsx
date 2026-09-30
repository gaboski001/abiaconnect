import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

import { MobileTopBar } from '@/components/mobile/MobileTopBar'
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav'
import { isNativeApp } from '@/components/mobile/NativeAuthLayout'
import { InstallAppPrompt } from '@/components/pwa/InstallAppPrompt'
import { IOSInstallPrompt } from '@/components/pwa/IOSInstallPrompt'
import { UpdateAvailablePrompt } from '@/components/pwa/UpdateAvailablePrompt'
import { ModerationBlockedDialog } from '@/components/moderation/ModerationBlockedDialog'
import { useSiteSettings } from '@/hooks/useSiteSettings'


export function MainLayout() {
  const location = useLocation()
  const { settings } = useSiteSettings()
  const siteTheme = settings.theme || settings.site_theme || 'default'

  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  // Hide the site footer on the chat page in the native app so the chat
  // composer sits flush against the bottom nav — a proper messenger feel.
  const isChatRoute = /^\/messages(\/|$)/.test(location.pathname)
  // A specific chat detail (e.g. /messages/abc123). On native we want a
  // full-bleed WhatsApp-style chat: no top bar, no bottom nav, no page padding.
  const isChatDetail = /^\/messages\/[^/]+/.test(location.pathname)
  const native = isNativeApp()
  const immersiveChat = isChatDetail && native
  const hideFooter = isAuthPage || (isChatRoute && native)
  const hideTopBar = isAuthPage || immersiveChat
  const hideBottomNav = isAuthPage || immersiveChat

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col">
      {!hideTopBar && <MobileTopBar />}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {!online && (
        <div className="bg-yellow-400/90 text-yellow-950 text-sm text-center py-2 px-4">
          You are offline. Some features may be unavailable.
        </div>
      )}

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={
              immersiveChat
                ? 'h-[calc(100dvh-var(--kb-inset,0px))] transition-[height] duration-150'
                : 'mx-auto max-w-[1400px] px-3 sm:px-4 md:px-6 py-6 md:py-12'
            }
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {!hideFooter && <Footer />}

      {/* Native-only premium navigation shell */}
      {!hideBottomNav && <MobileBottomNav />}

      {/* PWA notices removed by user request */}
      <ModerationBlockedDialog />
    </div>
  )
}


export default MainLayout
