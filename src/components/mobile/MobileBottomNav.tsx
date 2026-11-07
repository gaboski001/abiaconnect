import { useState } from 'react'
import { Handshake, Home, LayoutGrid, MessageCircle, Users, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { useUnreadMessagesCount } from '@/components/messages/MessagesBell'
import { GOLD_GRADIENT } from '@/lib/mobileBrand'
import { isNativeApp } from './NativeAuthLayout'
import { NativeMoreSheet } from './NativeMoreSheet'

type Tab = {
  to: string
  label: string
  icon: LucideIcon
  match: (pathname: string) => boolean
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' || p.startsWith('/category') || p.startsWith('/thread') },
  { to: '/subgroups', label: 'Community', icon: Users, match: (p) => p.startsWith('/subgroups') },
  { to: '/messages', label: 'Messages', icon: MessageCircle, match: (p) => p.startsWith('/messages') },
  { to: '/relationship', label: 'Connect', icon: Handshake, match: (p) => p.startsWith('/relationship') },
]

/**
 * App-only bottom navigation: four main sections plus "More", which slides up
 * a sheet with every other feature (see NativeMoreSheet). Replaces the side
 * drawer in the app, so each destination has exactly one entry point.
 */
export function MobileBottomNav() {
  if (!isNativeApp()) return null
  return <NativeBottomNav />
}

function NativeBottomNav() {
  const location = useLocation()
  const { user } = useAuth()
  const { hasUpdate } = useAppUpdate()
  const unread = useUnreadMessagesCount()
  const [moreOpen, setMoreOpen] = useState(false)

  const itemClass = (active: boolean) =>
    cn(
      'relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors active:bg-muted',
      active ? 'font-bold text-foreground' : 'text-muted-foreground',
    )

  const iconClass = (active: boolean) =>
    cn(
      'relative flex h-8 w-12 items-center justify-center rounded-xl transition-all duration-200',
      active && 'scale-105 text-[#0B1F0B] shadow-sm',
    )
  const iconStyle = (active: boolean) => (active ? { backgroundImage: GOLD_GRADIENT } : undefined)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-1.5 py-1.5">
          {TABS.map((tab) => {
            const active = !moreOpen && tab.match(location.pathname)
            const badge = tab.to === '/messages' && user && unread > 0 ? unread : 0
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-label={badge ? `${tab.label}, ${badge} unread` : tab.label}
                aria-current={active ? 'page' : undefined}
                className={itemClass(active)}
              >
                <span className={iconClass(active)} style={iconStyle(active)}>
                  <tab.icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
                  {badge ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={itemClass(moreOpen)}
          >
            <span className={iconClass(moreOpen)} style={iconStyle(moreOpen)}>
              <LayoutGrid className="size-[22px]" strokeWidth={moreOpen ? 2.3 : 1.9} />
              {hasUpdate ? (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500 ring-2 ring-card" aria-label="Update available" />
              ) : null}
            </span>
            More
          </button>
        </div>
      </nav>
      <NativeMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}

export default MobileBottomNav
