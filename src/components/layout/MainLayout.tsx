import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

import { MobileTopBar } from '@/components/mobile/MobileTopBar'
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

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col">
      {!isAuthPage && <MobileTopBar />}
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
            className="mx-auto max-w-[1400px] px-3 sm:px-4 md:px-6 py-6 md:py-12"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {!isAuthPage && <Footer />}
      
      {!isAuthPage && <InstallAppPrompt />}
      {!isAuthPage && <IOSInstallPrompt />}
      {!isAuthPage && <UpdateAvailablePrompt />}
      <ModerationBlockedDialog />
    </div>
  )
}

export default MainLayout
