import { useMemo, useState } from 'react'
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
  Menu,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND } from '@/lib/mobileBrand'

type Item = {
  to: string
  label: string
  icon: LucideIcon
  external?: boolean
  match: (pathname: string) => boolean
}

/**
 * Left-side slide-out drawer that replaces the bottom tab bar on mobile.
 * Mirrors the tablet/desktop sidebar pattern. Opens from a hamburger trigger
 * placed in the mobile top bar.
 */
export function MobileSideNav() {
  const location = useLocation()
  const { user, role, isAdmin } = useAuth()
  const { settings } = useSiteSettings()
  const [open, setOpen] = useState(false)

  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p) => p === '/dashboard' },
      { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
      { to: '/polls', label: 'Polls', icon: BarChart3, match: (p) => p.startsWith('/polls') },
      { to: '/subgroups', label: 'Community', icon: Compass, match: (p) => p.startsWith('/subgroups') },
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
      list.push({ to: '/admin/dashboard', label: 'Admin', icon: ShieldCheck, match: (p) => p.startsWith('/admin/dashboard') })
      list.push({ to: '/admin/donations', label: 'Donations', icon: Users, match: (p) => p.startsWith('/admin/donations') })
    }
    if (!user || role === 'guest') {
      const idx = list.findIndex((i) => i.to === '/dashboard')
      if (idx >= 0) list.splice(idx, 1)
    }
    return list
  }, [isAdmin, role, storeLink, subgroupsEnabled, user])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="md:hidden h-9 w-9 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/[0.08]"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[80vw] max-w-[300px] border-r border-white/10 bg-[rgba(5,10,18,0.98)] p-0 text-slate-100"
      >
        <SheetHeader className="border-b border-white/10 px-4 py-3 text-left">
          <SheetTitle className="text-sm font-black uppercase tracking-[0.18em] text-slate-200">
            Menu
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3" aria-label="Mobile navigation">
          {items.map((item) => {
            const active = item.match(location.pathname)
            const Icon = item.icon
            const className = cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors active:scale-[0.98]',
              !active && 'text-slate-300/85 hover:bg-white/[0.06]'
            )
            const style = active
              ? { backgroundImage: GOLD_GRADIENT, color: MOBILE_BRAND.ink, boxShadow: GOLD_SHADOW }
              : undefined
            const inner = (
              <>
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </>
            )
            if (item.external) {
              return (
                <a
                  key={item.to}
                  href={item.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  style={style}
                  onClick={() => setOpen(false)}
                >
                  {inner}
                </a>
              )
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={className}
                style={style}
                onClick={() => setOpen(false)}
              >
                {inner}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export default MobileSideNav
