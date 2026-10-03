import { useState } from 'react'
import { canDonateHere } from '@/lib/storePolicy'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, HandHeart, LogOut, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { MessagesBell } from '@/components/messages/MessagesBell'
import { cn } from '@/lib/utils'
import { SiteLogo } from './SiteLogo'
import { SiteNavDrawer } from './SiteNavDrawer'
import { isNavItemActive, useNavSections, type NavItem } from './navItems'

export function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { settings } = useSiteSettings()
  const { primary, community } = useNavSections()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const siteName = settings.site_name || 'AbiaConnect'
  // Donate gets its own button on the right; the rest sit in the main nav.
  const navItems = [...primary, ...community.filter((i) => !i.highlight)]

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    setSearchOpen(false)
  }

  const searchField = (autoFocus = false) => (
    <form onSubmit={onSearch} className="relative" role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search discussions…"
        aria-label="Search"
        autoFocus={autoFocus}
        className="h-9 w-full rounded-full border-border bg-muted/50 pl-9 focus-visible:bg-background"
      />
    </form>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-[1248px] items-center gap-4 px-6">
        {/* Left: menu (tablet) + brand */}
        <div className="flex shrink-0 items-center gap-2">
          <SiteNavDrawer triggerClassName="lg:hidden" />
          <Link to="/" className="flex items-center rounded-lg" aria-label={`${siteName} home`}>
            <SiteLogo imageClassName="h-10 max-w-[190px]" />
          </Link>
        </div>

        {/* Center: primary navigation */}
        <nav aria-label="Main" className="hidden flex-1 items-center justify-center lg:flex">
          <ul className="flex items-center gap-0.5">
            {navItems.map((item) => (
              <li key={item.label}>
                <HeaderLink item={item} active={isNavItemActive(item, pathname)} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Right: search, actions, account */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
          {/* Full search on tablets (no nav row) and wide screens */}
          <div className="hidden w-56 md:block lg:hidden xl:block xl:w-52 2xl:w-64">{searchField()}</div>
          {/* Compact search where the nav row takes the space */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Search" className="hidden rounded-full lg:inline-flex xl:hidden">
                <Search className="size-[18px]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 rounded-2xl p-2">
              {searchField(true)}
            </PopoverContent>
          </Popover>

          {canDonateHere() && <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden h-9 rounded-full border-rose-500/30 px-3.5 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 lg:inline-flex dark:text-rose-400"
          >
            <Link to="/donate">
              <HandHeart className="size-4" /> Donate
            </Link>
          </Button>}

          <Separator orientation="vertical" className="mx-1 hidden h-6 lg:block" />

          <ThemeToggle />

          {user ? (
            <>
              <MessagesBell />
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <div className="ml-1 hidden items-center gap-2 sm:flex">
              <Button variant="ghost" asChild className="h-9 rounded-full px-4">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild className="h-9 rounded-full px-4">
                <Link to="/register">Join Free</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function HeaderLink({ item, active }: { item: NavItem; active: boolean }) {
  // Website style: text links with an underline for the current section
  // (the app uses tabs and pills instead).
  const className = cn(
    'relative inline-flex h-16 items-center gap-1 whitespace-nowrap px-2.5 text-[15px] font-medium transition-colors xl:px-3',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'after:absolute after:inset-x-2.5 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors',
    active
      ? 'text-primary after:bg-primary'
      : 'text-foreground/70 hover:text-foreground after:bg-transparent hover:after:bg-border',
  )
  if (item.external) {
    return (
      <a href={item.to} target="_blank" rel="noopener noreferrer" className={className}>
        {item.label}
        <ArrowUpRight className="size-3.5 opacity-60" aria-hidden />
      </a>
    )
  }
  return (
    <Link to={item.to} className={className} aria-current={active ? 'page' : undefined}>
      {item.label}
    </Link>
  )
}

/** Avatar button with account, admin and sign-out actions. */
function UserMenu() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const { account, admin } = useNavSections()
  const [open, setOpen] = useState(false)

  if (!user) return null
  const displayName = profile?.display_name || user.email

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  const menuLink = (item: NavItem) => {
    const Icon = item.icon
    const active = isNavItemActive(item, pathname)
    return (
      <Link
        key={item.label}
        to={item.to}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
          active ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
        )}
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {item.label}
      </Link>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="ml-1 flex items-center gap-1 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar avatarUrl={profile?.avatar_url} displayName={displayName} size="sm" className="border-0" />
          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-2xl p-2">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <UserAvatar avatarUrl={profile?.avatar_url} displayName={displayName} size="sm" className="border-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile?.display_name || 'My account'}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Separator className="my-1.5" />
        {account.map(menuLink)}
        {admin.length > 0 && (
          <>
            <Separator className="my-1.5" />
            <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
            {admin.map(menuLink)}
          </>
        )}
        <Separator className="my-1.5" />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
        >
          <LogOut className="size-4" aria-hidden />
          Sign Out
        </button>
      </PopoverContent>
    </Popover>
  )
}

export default Navbar
