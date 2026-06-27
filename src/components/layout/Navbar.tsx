import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { RealtimeStatus } from '@/components/RealtimeStatus'
import { MessagesBell } from '@/components/messages/MessagesBell'
import { cn } from '@/lib/utils'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

type NavItem = {
  label: string
  href: string
  external?: boolean
  accent?: 'rose'
  requiresAuth?: boolean
  requiresAdmin?: boolean
}

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, isAdmin, signOut } = useAuth()
  const { settings } = useSiteSettings()
  const { data: profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)

  const siteName = settings.site_name || 'AbiaConnect'
  const siteTagline = settings.site_tagline || 'Connecting Abians Worldwide'
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const showLogoImage = !!logoUrl && !logoFailed
  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link

  useEffect(() => {
    setLogoFailed(false)
  }, [settings.site_logo, settings.logo_url, logoUrl])

  const items = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { label: 'Forums', href: '/' },
      { label: 'Polls', href: '/polls' },
      { label: 'About Us', href: '/about' },
      { label: 'Donate ❤️', href: '/donate', accent: 'rose' },
    ]

    if (subgroupsEnabled) base.push({ label: 'Subgroups', href: '/subgroups' })
    if (storeLink) base.push({ label: 'Store', href: storeLink, external: true })
    if (user && role !== 'guest') base.push({ label: 'My Dashboard', href: '/dashboard', requiresAuth: true })
    if (isAdmin) {
      base.push({ label: 'Admin Portal', href: '/admin/dashboard', requiresAdmin: true })
      base.push({ label: 'Donations', href: '/admin/donations', requiresAdmin: true })
    }
    return base
  }, [isAdmin, role, storeLink, subgroupsEnabled, user])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/?q=${encodeURIComponent(query.trim())}`)
  }

  const handleSignOut = async () => {
    await signOut()
    setOpen(false)
    navigate('/')
  }

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return href.startsWith('http') ? false : location.pathname.startsWith(href)
  }

  const renderNavLink = (item: NavItem, mobile = false) => {
    const active = isActive(item.href)
    const className = cn(
      'group inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200',
      mobile ? 'justify-between border' : 'border',
      item.accent === 'rose'
        ? 'border-rose-200/80 text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:border-rose-400/30 dark:hover:bg-rose-500/10'
        : active
          ? 'text-slate-950 dark:text-slate-950'
          : 'border-slate-200/80 bg-white/85 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]'
    )

    const style = active
      ? { backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }
      : item.accent === 'rose'
        ? undefined
        : mobile
          ? { background: 'rgba(255,255,255,0.02)' }
          : undefined

    const label = (
      <>
        <span>{item.label}</span>
        {active && !item.accent ? <Sparkles className="size-3.5" /> : null}
      </>
    )

    if (item.external) {
      return (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          style={style}
        >
          {label}
        </a>
      )
    }

    return (
      <Link key={item.label} to={item.href} className={className} style={style}>
        {label}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/88 backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(5,10,18,0.84)]">
      <div className="mx-auto flex min-h-20 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl border border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-100 lg:hidden dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[22rem] border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] px-0 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(5,10,18,0.98)_0%,rgba(10,18,32,0.98)_100%)]"
            >
              <SheetHeader className="px-5 pb-2 pr-14 text-left">
                <SheetTitle asChild>
                  <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-3" aria-label={siteName}>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/90 dark:border-white/10 dark:bg-white/[0.06]"
                      style={{ boxShadow: PREMIUM_SHADOW }}
                    >
                      {showLogoImage ? (
                        <img
                          src={logoUrl as string}
                          alt={siteName}
                          onError={() => setLogoFailed(true)}
                          className="h-8 w-auto max-w-[120px] object-contain"
                        />
                      ) : (
                        <span className="text-base font-black" style={{ color: MOBILE_BRAND.goldWarm }}>
                          AC
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950 dark:text-white">{siteName}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300/72">{siteTagline}</p>
                    </div>
                  </Link>
                </SheetTitle>
                <SheetDescription className="pt-2 text-sm text-slate-600 dark:text-slate-300/72">
                  Premium navigation for forums, subgroups, updates, and account tools.
                </SheetDescription>
              </SheetHeader>

              <div className="px-5">
                <form onSubmit={onSearch} className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search discussions, updates, members…"
                    className="h-12 rounded-2xl border-slate-200/80 bg-white/90 pl-10 text-slate-950 placeholder:text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-400"
                  />
                </form>

                <div className="mt-5 rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div
                    className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/82"
                    style={{ background: GOLD_GRADIENT_SOFT }}
                  >
                    <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                    Menu
                  </div>
                  <nav className="flex flex-col gap-3" onClick={() => setOpen(false)}>
                    {items.map((item) => renderNavLink(item, true))}
                  </nav>
                </div>

                <div className="mt-5 rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  {user ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          avatarUrl={profile?.avatar_url}
                          displayName={profile?.display_name || user.email}
                          size="sm"
                          className="border-slate-200 dark:border-white/10"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                            {profile?.display_name || user.email}
                          </p>
                          <p className="truncate text-xs text-slate-600 dark:text-slate-300/72">Signed in</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="h-11 w-full rounded-2xl border-slate-200/80 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/[0.06]"
                      >
                        <LogOut className="mr-2 size-4" /> Sign Out
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        asChild
                        className="h-11 w-full rounded-2xl border-slate-200/80 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/[0.06]"
                        onClick={() => setOpen(false)}
                      >
                        <Link to="/login">Sign In</Link>
                      </Button>
                      <Button
                        asChild
                        className="h-11 w-full rounded-2xl border-0 font-bold text-slate-950"
                        style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                        onClick={() => setOpen(false)}
                      >
                        <Link to="/register">Join Free</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={siteName}>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-white/[0.06]"
              style={{ boxShadow: '0 20px 50px -38px rgba(15,23,42,0.34)' }}
            >
              {showLogoImage ? (
                <img
                  src={logoUrl as string}
                  alt={siteName}
                  onError={() => setLogoFailed(true)}
                  className="h-8 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <span className="text-base font-black" style={{ color: MOBILE_BRAND.goldWarm }}>
                  AC
                </span>
              )}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-base font-black text-slate-950 dark:text-white">{siteName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300/70">{siteTagline}</p>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/92 p-2 lg:flex dark:border-white/10 dark:bg-white/[0.04]">
          {items.map((item) => renderNavLink(item))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <form onSubmit={onSearch} className="relative hidden xl:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search community"
              className="h-11 w-72 rounded-2xl border-slate-200/80 bg-white/92 pl-10 text-slate-950 placeholder:text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-400"
            />
          </form>

          <ThemeToggle />
          <RealtimeStatus className="hidden md:inline-flex" />

          {user ? (
            <>
              <MessagesBell />
              <NotificationBell />
              <Link to="/profile" aria-label="Profile" className="flex rounded-full">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  displayName={profile?.display_name || user.email}
                  size="sm"
                  className="border-slate-200 dark:border-white/10"
                />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="rounded-2xl border border-slate-200/80 bg-white/85 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
              >
                <LogOut className="size-4.5" />
              </Button>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                variant="outline"
                asChild
                className="h-11 rounded-2xl border-slate-200/80 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/[0.06]"
              >
                <Link to="/login">Sign In</Link>
              </Button>
              <Button
                asChild
                className="h-11 rounded-2xl border-0 px-5 font-bold text-slate-950"
                style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
              >
                <Link to="/register">Join Free</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
