import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Compass, MessageCircleMore, Bell, UserRound, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isNativeApp } from './NativeAuthLayout'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

type Tab = {
  to: string
  label: string
  icon: LucideIcon
  match: (p: string) => boolean
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
  { to: '/subgroups', label: 'Community', icon: Compass, match: (p) => p.startsWith('/subgroups') },
  { to: '/messages', label: 'Chats', icon: MessageCircleMore, match: (p) => p.startsWith('/messages') },
  { to: '/notifications', label: 'Alerts', icon: Bell, match: (p) => p.startsWith('/notifications') },
  { to: '/profile', label: 'Profile', icon: UserRound, match: (p) => p.startsWith('/profile') || p.startsWith('/dashboard') },
]

/**
 * Native-only bottom tab bar. Rendered exclusively when running inside the
 * installed Capacitor Android/iOS shell — the web project is untouched.
 */
export function NativeBottomNav() {
  const location = useLocation()
  const [native, setNative] = useState(false)

  useEffect(() => {
    setNative(isNativeApp())
  }, [])

  if (!native) return null

  return (
    <>
      {/* Spacer so page content isn't hidden beneath the fixed bar */}
      <div aria-hidden className="h-[5.5rem]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 backdrop-blur-2xl"
        style={{
          backgroundColor: 'rgba(11,31,11,0.96)',
          boxShadow: PREMIUM_SHADOW,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {TABS.map(({ to, label, icon: Icon, match }) => {
            const active = match(location.pathname)
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all active:scale-95',
                    !active && 'text-slate-300/75',
                  )}
                  style={
                    active
                      ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, boxShadow: GOLD_SHADOW }
                      : undefined
                  }
                >
                  <Icon className="size-[1.15rem]" strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}

export default NativeBottomNav
