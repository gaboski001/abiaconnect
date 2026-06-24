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

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password'
  const isDashboard = location.pathname.startsWith('/dashboard')

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {!online && (
        <div className="bg-yellow-400/90 text-yellow-950 text-[10px] uppercase font-bold text-center py-2 px-4 z-[60]">
          You are offline. Some features may be unavailable.
        </div>
      )}

      <main className={`flex-1 flex flex-col ${Capacitor.isNativePlatform() && !isAuthPage ? 'pb-24' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-6 md:py-12"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Show footer on dashboard and home as requested, but hide if it blocks bottom nav too much */}
      <Footer />

      {!isAuthPage && <MobileBottomNav />}
    </div>
  )
}

export default MainLayout
