import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { cn } from '@/lib/utils'

const isNative = Capacitor.isNativePlatform()

export function MainLayout() {
  const location = useLocation()
  const { settings } = useSiteSettings()
  const siteTheme = settings.theme || settings.site_theme || 'default'

  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

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

  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname)

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col">
      {!isAuthPage && (
        <div className="hidden md:block">
          <Navbar />
        </div>
      )}

      {!online && (
        <div className="bg-yellow-400/90 px-4 py-2 text-center text-sm text-yellow-950">
          You are offline. Some features may be unavailable.
        </div>
      )}

      <main className={cn('flex-1', !isAuthPage && 'pb-24 md:pb-0')}>
        <div
          className={cn(
            'mx-auto max-w-[1400px] px-3 py-6 sm:px-4 md:px-6 md:py-12',
            isAuthPage && 'max-w-none px-0 py-0 md:py-0',
          )}
        >
          <Outlet />
        </div>
      </main>

      {!isAuthPage && !isNative && <div className="hidden md:block"><Footer /></div>}
      {!isAuthPage && <MobileBottomNav />}
    </div>
  )
}

export default MainLayout
