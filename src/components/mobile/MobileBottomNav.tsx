import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  Bell,
  Users,
  MessageCircleMore,
  UserRound,
  Home,
  Heart,
  LayoutDashboard,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'
import { useAppUpdate } from '@/hooks/useAppUpdate'

type Item = {
  to: string
  label: string
  icon: LucideIcon
  match: (pathname: string) => boolean
}

export function MobileBottomNav() {
  const location = useLocation()
  const { user, role } = useAuth()
  const { settings } = useSiteSettings()
  const [isNative, setIsNative] = useState(false)
  const { hasUpdate } = useAppUpdate()

  useEffect(() => {
    const check = () => setIsNative(Capacitor.isNativePlatform());
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [
      { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
      { to: '/subgroups', label: 'Community', icon: Users, match: (p) => p.startsWith('/subgroups') },
      { to: '/messages', label: 'Messages', icon: MessageCircleMore, match: (p) => p.startsWith('/messages') },
      { to: '/relationship', label: 'Relationship', icon: Heart, match: (p) => p.startsWith('/relationship') },
      { to: '/notifications', label: 'Alerts', icon: Bell, match: (p) => p.startsWith('/notifications') },
      { to: '/profile', label: 'Profile', icon: UserRound, match: (p) => p.startsWith('/profile') },
      { to: '/version', label: 'More', icon: MoreHorizontal, match: (p) => p === '/version' },
    ]

    if (!user || role === 'guest') {
      // hide dashboard for guests
      const idx = list.findIndex((i) => i.to === '/dashboard')
      if (idx >= 0) list.splice(idx, 1)
    }
    return list
  }, [role, user])

  if (!isNative) return null;

  return (
    <nav
      className="fixed inset-x-3 z-40 rounded-[1.8rem] border border-white/10 bg-[rgba(5,10,18,0.96)] px-1.5 py-2 backdrop-blur-2xl md:hidden"
      style={{ boxShadow: PREMIUM_SHADOW, bottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      aria-label="Mobile navigation"
    >
      <div
        className="scrollbar-none flex flex-1 snap-x snap-mandatory items-stretch gap-1 overflow-x-auto scroll-smooth px-0.5"
        role="tablist"
      >
        {items.map((item) => {
          const active = item.match(location.pathname)
          const Icon = item.icon
          const inner = (
            <>
              <Icon className="size-[1.08rem] shrink-0" />
              <span className="truncate text-[9px] uppercase tracking-[0.14em]">{item.label}</span>
            </>
          )
          const className = cn(
            'flex min-h-[4.25rem] w-[4.75rem] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-[1.2rem] px-1 py-2 text-[10px] font-semibold leading-none transition-transform active:scale-[0.98]',
            !active && 'text-slate-300/72 hover:bg-white/[0.04]'
          )
          const style = active
            ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, boxShadow: GOLD_SHADOW }
            : undefined

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={className}
              style={style}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
