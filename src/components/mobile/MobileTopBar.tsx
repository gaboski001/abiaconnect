import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MessagesBell } from '@/components/messages/MessagesBell'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Button } from '@/components/ui/button'
import { GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'
import { SiteLogo } from '@/components/layout/SiteLogo'
import { MobileSideNav } from './MobileSideNav'
import { isNativeApp } from './NativeAuthLayout'
import { nativeScreenFor } from './nativeRoutes'

/**
 * App header. Home: logo. Tab roots (Community, Messages, Connect): a large
 * title. Inner screens: back button + title. Notifications bell on the right
 * for members. Everything else lives in the bottom tabs and "More".
 */
function NativeTopBar() {
  const { user } = useAuth()
  const { settings } = useSiteSettings()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const siteName = settings.site_name || 'AbiaConnect'
  const screen = nativeScreenFor(pathname)
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

  return (
    <header className="md:hidden sticky top-0 z-50 border-b border-white/[0.08] bg-[rgba(8,13,23,0.94)] backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-2">
        {screen.kind === 'home' ? (
          <Link to="/" className="ml-2 flex min-w-0 items-center" aria-label={`${siteName} home`}>
            <SiteLogo nameFallback={false} imageClassName="h-8 max-w-[130px]" className="h-8 w-20" />
          </Link>
        ) : screen.kind === 'tab' ? (
          <h1 className="ml-2 truncate text-[22px] font-bold tracking-tight text-white">{screen.title}</h1>
        ) : (
          <>
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-100 active:bg-white/10"
            >
              <ChevronLeft className="size-6" />
            </button>
            <p className="min-w-0 truncate text-[17px] font-semibold text-white">{screen.title}</p>
          </>
        )}
        <div className="ml-auto flex items-center pr-1">
          {user ? (
            pathname === '/notifications' ? null : (
              <div className="dark flex items-center text-slate-100">
                <NotificationBell />
              </div>
            )
          ) : (
            <Button
              asChild
              size="sm"
              className="h-9 rounded-xl border-0 px-4 text-[13px] font-bold text-slate-950"
              style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
            >
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export function MobileTopBar() {
  if (isNativeApp()) return <NativeTopBar />
  return <WebMobileTopBar />
}

function WebMobileTopBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'

  return (
    <header className="md:hidden sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(5,10,18,0.88)]">
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-1">
          <MobileSideNav />
          <Link to="/" className="flex min-w-0 items-center" aria-label={siteName}>
            <SiteLogo nameFallback={false} imageClassName="h-8 max-w-[130px]" className="h-8 w-20" />
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <>
              <MessagesBell />
              <NotificationBell />
              <Link to="/profile" aria-label="Profile" className="ml-1 flex rounded-full">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  displayName={profile?.display_name || user.email}
                  size="xs"
                  className="border-slate-200 dark:border-white/10"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => { await signOut(); navigate('/') }}
                aria-label="Sign out"
                className="h-9 w-9 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/[0.08]"
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              asChild
              size="sm"
              className="h-8 rounded-xl border-0 px-3 text-xs font-bold text-slate-950"
              style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
            >
              <Link to="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export default MobileTopBar
