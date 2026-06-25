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
  const isNative = Capacitor.isNativePlatform()

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {!online && (
        <div className="bg-yellow-400 text-yellow-950 text-[10px] uppercase font-black text-center py-1.5 px-4 z-[100] relative">
          You are currently offline
        </div>
      )}

      {/* Main Content: Flexible height but allowing body scroll */}
      <main className={`flex-1 flex flex-col w-full ${isNative && !isAuthPage ? 'pb-32' : ''}`}>
        {!isNative ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-6 md:py-12"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex-1 mx-auto w-full max-w-[1400px] px-4 py-6 md:py-10">
            <Outlet />
          </div>
        )}
        <Footer />
      </main>

      {!isAuthPage && <MobileBottomNav />}
    </div>
  )
}

export default MainLayout
