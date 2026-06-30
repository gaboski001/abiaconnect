import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MessagesBell } from '@/components/messages/MessagesBell'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { MOBILE_BRAND, GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'
import { MobileSideNav } from './MobileSideNav'

export function MobileTopBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => setLogoFailed(false), [logoUrl])
  const showLogo = !!logoUrl && !logoFailed

  return (
    <header className="md:hidden sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(5,10,18,0.88)]">
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-1">
          <MobileSideNav />
          <Link to="/" className="flex min-w-0 items-center gap-2" aria-label={siteName}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-white/[0.06]">
              {showLogo ? (
                <img
                  src={logoUrl as string}
                  alt={siteName}
                  onError={() => setLogoFailed(true)}
                  className="h-6 w-auto max-w-[80px] object-contain"
                />
              ) : (
                <span className="text-xs font-black" style={{ color: MOBILE_BRAND.goldWarm }}>AC</span>
              )}
            </div>
            <span className="truncate text-sm font-black text-slate-950 dark:text-white">{siteName}</span>
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
