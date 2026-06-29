import { useMemo, useRef } from 'react'
import {
  Bell,
  Compass,
  LayoutDashboard,
  MessageCircleMore,
  UserRound,
  Home,
  BarChart3,
  Info,
  Heart,
  Users,
  ShieldCheck,
  Store,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

type Item = {
  to: string
  label: string
  icon: LucideIcon
  external?: boolean
  match: (pathname: string) => boolean
}

export function MobileBottomNav() {
  const location = useLocation()
  const { user, role, isAdmin } = useAuth()
  const { settings } = useSiteSettings()
  const scrollerRef = useRef<HTMLDivElement>(null)

  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
      { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
      { to: '/polls', label: 'Polls', icon: BarChart3, match: (p) => p.startsWith('/polls') },
      {
        to: '/subgroups',
        label: 'Community',
        icon: Compass,
        match: (p) => p.startsWith('/subgroups'),
      },
      { to: '/messages', label: 'Chats', icon: MessageCircleMore, match: (p) => p.startsWith('/messages') },
      { to: '/notifications', label: 'Alerts', icon: Bell, match: (p) => p.startsWith('/notifications') },
      { to: '/profile', label: 'Profile', icon: UserRound, match: (p) => p.startsWith('/profile') },
      { to: '/about', label: 'About', icon: Info, match: (p) => p.startsWith('/about') },
      { to: '/donate', label: 'Donate', icon: Heart, match: (p) => p.startsWith('/donate') },
    ]

    if (!subgroupsEnabled) {
      const idx = list.findIndex((i) => i.to === '/subgroups')
      if (idx >= 0) list.splice(idx, 1)
    }
    if (storeLink) {
      list.push({ to: storeLink, label: 'Store', icon: Store, external: true, match: () => false })
    }
    if (isAdmin) {
      list.push({
        to: '/admin/dashboard',
        label: 'Admin',
        icon: ShieldCheck,
        match: (p) => p.startsWith('/admin/dashboard'),
      })
      list.push({
        to: '/admin/donations',
        label: 'Donations',
        icon: Users,
        match: (p) => p.startsWith('/admin/donations'),
      })
    }
    if (!user || role === 'guest') {
      // hide dashboard for guests
      const idx = list.findIndex((i) => i.to === '/dashboard')
      if (idx >= 0) list.splice(idx, 1)
    }
    return list
  }, [isAdmin, role, storeLink, subgroupsEnabled, user])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  return (
    <nav
      className="fixed inset-x-3 z-40 rounded-[1.8rem] border border-white/10 bg-[rgba(5,10,18,0.96)] px-1.5 py-2 backdrop-blur-2xl md:hidden"
      style={{ boxShadow: PREMIUM_SHADOW, bottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      aria-label="Mobile navigation"
    >
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          aria-label="Scroll menu left"
          onClick={() => scrollBy(-1)}
          className="flex h-10 w-7 shrink-0 items-center justify-center rounded-full text-slate-300/80 hover:bg-white/[0.06] active:scale-95"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          ref={scrollerRef}
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

            if (item.external) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  className={className}
                  style={style}
                >
                  {inner}
                </a>
              )
            }
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

        <button
          type="button"
          aria-label="Scroll menu right"
          onClick={() => scrollBy(1)}
          className="flex h-10 w-7 shrink-0 items-center justify-center rounded-full text-slate-300/80 hover:bg-white/[0.06] active:scale-95"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  )
}

export default MobileBottomNav
