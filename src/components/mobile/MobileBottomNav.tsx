import { Bell, Compass, LayoutDashboard, MessageCircleMore, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

type Item = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  match: (pathname: string) => boolean
}

const ITEMS: Item[] = [
  {
    to: '/dashboard',
    label: 'Home',
    icon: LayoutDashboard,
    match: (pathname) => pathname === '/dashboard',
  },
  {
    to: '/subgroups',
    label: 'Community',
    icon: Compass,
    match: (pathname) => pathname.startsWith('/subgroups') || pathname === '/polls',
  },
  {
    to: '/messages',
    label: 'Chats',
    icon: MessageCircleMore,
    match: (pathname) => pathname.startsWith('/messages'),
  },
  {
    to: '/notifications',
    label: 'Alerts',
    icon: Bell,
    match: (pathname) => pathname.startsWith('/notifications'),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: UserRound,
    match: (pathname) => pathname.startsWith('/profile'),
  },
]

export function MobileBottomNav() {
  const location = useLocation()

  return (
    <nav
      className="fixed inset-x-3 z-40 rounded-[1.8rem] border border-white/10 bg-[rgba(5,10,18,0.96)] px-2 py-2 backdrop-blur-2xl md:hidden"
      style={{ boxShadow: PREMIUM_SHADOW, bottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 gap-1">
        {ITEMS.map((item) => {
          const active = item.match(location.pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={cn(
                'flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-[1.2rem] px-1 py-2 text-[10px] font-semibold leading-none transition-transform active:scale-[0.98]',
                !active && 'text-slate-300/72 hover:bg-white/[0.04]'
              )}
              style={active ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, boxShadow: GOLD_SHADOW } : undefined}
            >
              <Icon className="size-[1.08rem] shrink-0" />
              <span className="truncate text-[9px] uppercase tracking-[0.14em]">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
