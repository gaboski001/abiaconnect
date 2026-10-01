import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, LogOut, Menu, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { cn } from '@/lib/utils'
import { SiteLogo } from './SiteLogo'
import { isNavItemActive, useNavSections, type NavItem } from './navItems'

/**
 * Slide-out navigation used on phones (MobileTopBar) and tablets (Navbar):
 * branded header, search, grouped sections with icons and an active state,
 * and an account footer.
 */
export function SiteNavDrawer({ triggerClassName }: { triggerClassName?: string }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const { settings } = useSiteSettings()
  const { sections } = useNavSections()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const siteName = settings.site_name || 'AbiaConnect'

  const close = () => setOpen(false)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    close()
  }

  const handleSignOut = async () => {
    await signOut()
    close()
    navigate('/')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className={cn('rounded-xl', triggerClassName)}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[19rem] flex-col gap-0 p-0 sm:w-80">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle asChild>
            <Link to="/" onClick={close} className="flex items-center gap-3" aria-label={siteName}>
              <SiteLogo />
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>

        <div className="px-5 pt-4">
          <form onSubmit={onSearch} className="relative" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search discussions…"
              aria-label="Search"
              className="h-10 rounded-xl bg-muted/50 pl-9"
            />
          </form>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {sections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.label}>
                    <DrawerLink item={item} active={isNavItemActive(item, pathname)} onNavigate={close} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" onClick={close} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-muted">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  displayName={profile?.display_name || user.email}
                  size="sm"
                  className="border-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{profile?.display_name || 'My account'}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </Link>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out" className="shrink-0 rounded-xl">
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild onClick={close} className="rounded-xl">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild onClick={close} className="rounded-xl">
                <Link to="/register">Join Free</Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DrawerLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  const className = cn(
    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'bg-primary/10 text-primary dark:bg-primary/15'
      : item.highlight
        ? 'text-rose-600 hover:bg-rose-500/10 dark:text-rose-400'
        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
  )
  const content = (
    <>
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.external && <ArrowUpRight className="size-3.5 opacity-60" aria-hidden />}
    </>
  )

  if (item.external) {
    return (
      <a href={item.to} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className}>
        {content}
      </a>
    )
  }
  return (
    <Link to={item.to} onClick={onNavigate} className={className} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  )
}

export default SiteNavDrawer
