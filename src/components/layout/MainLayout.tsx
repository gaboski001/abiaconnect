import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
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
import { toast } from '@/lib/toast'
import { CommunityPresence, PointsToaster } from '@/components/engagement/LiveCommunity'
import { StarterNextBar } from '@/components/engagement/StarterSteps'
import { VolunteerPowersClaimer } from '@/components/community/VolunteerPowersClaimer'
import { SupportChatLauncher } from '@/components/support/SupportChatLauncher'


export function MainLayout() {
  const location = useLocation()
  const { settings } = useSiteSettings()
  const siteTheme = settings.theme || settings.site_theme || 'default'

  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const on = () => {
      setOnline(true)
      toast.success('You are back online.', { id: 'no-network' })
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  // A specific chat detail (e.g. /messages/abc123). On native we want a
  // full-bleed WhatsApp-style chat: no top bar, no bottom nav, no page padding.
  const isChatDetail = /^\/messages\/[^/]+/.test(location.pathname)
  const native = isNativeApp()
  const immersiveChat = isChatDetail && native
  // The app has no website footer: its links all live in the More menu.
  const hideFooter = isAuthPage || native
  const hideTopBar = isAuthPage || immersiveChat
  // A live room has its own controls bar at the bottom (mic, raise hand, leave).
  const inLiveRoom = /^\/live\/[^/]+/.test(location.pathname)
  const hideBottomNav = isAuthPage || immersiveChat || inLiveRoom

  return (
    <div data-site-theme={siteTheme} className="min-h-screen flex flex-col">
      {!hideTopBar && <MobileTopBar />}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {!online && (
        <div role="status" className="flex items-center justify-center gap-2.5 bg-neutral-900 px-4 py-2.5 text-white dark:bg-neutral-800">
          <WifiOff className="size-4 shrink-0 text-amber-300" aria-hidden />
          <p className="text-[13px] leading-snug">
            <span className="font-semibold">No internet connection.</span>{' '}
            <span className="text-white/80">Check your Wi-Fi or mobile data. We'll reconnect when you're back online.</span>
          </p>
        </div>
      )}

      <main className="flex-1">
        {/* New members: where they are on the first 5 steps, on the pages the steps lead to. */}
        {!hideTopBar && <StarterNextBar />}
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
                : 'mx-auto max-w-[1248px] px-4 md:px-6 py-6 md:py-10 native:px-4 native:pb-[calc(7rem+env(safe-area-inset-bottom))] native:pt-4'
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
      <VolunteerPowersClaimer />
      {!isAuthPage && <SupportChatLauncher />}
      {/* Live community: members-online count and "+points" toasts. */}
      <CommunityPresence />
      <PointsToaster />
    </div>
  )
}


export default MainLayout
