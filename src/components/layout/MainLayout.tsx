import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Capacitor } from '@capacitor/core'


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

import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Capacitor } from '@capacitor/core'

/* ... */

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col">
      <Navbar />

      {!online && (
        <div className="bg-yellow-400/90 text-yellow-950 text-sm text-center py-2 px-4">
          You are offline. Some features may be unavailable.
        </div>
      )}

      <main className={`flex-1 ${Capacitor.isNativePlatform() ? 'pb-20' : ''}`}>
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

      {!Capacitor.isNativePlatform() && <Footer />}
      <MobileBottomNav />
    </div>
  )
}

export default MainLayout
