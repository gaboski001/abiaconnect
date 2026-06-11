import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LogOut,
  Menu,
  Search,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function Navbar() {
  const navigate = useNavigate()
  const { user, role, isAdmin, signOut } = useAuth()
  const { settings } = useSiteSettings()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const siteName = settings.site_name || 'AbiaConnect'
  const logoUrl = settings.site_logo || settings.logo_url
  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link

  const navLinks = (
    <>
      <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
        Forums
      </Link>
      <Link to="/polls" className="text-sm font-medium hover:text-primary transition-colors">
        Polls
      </Link>
      {subgroupsEnabled && (
        <Link to="/subgroups" className="text-sm font-medium hover:text-primary transition-colors">
          Subgroups
        </Link>
      )}
      {storeLink && (
        <a
          href={storeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:text-primary transition-colors"
        >
          Store
        </a>
      )}
      {user && role !== 'guest' && (
        <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
          My Dashboard
        </Link>
      )}
      {isAdmin && (
        <Link
          to="/admin/dashboard"
          className="text-sm font-medium hover:text-primary transition-colors"
        >
          Admin Portal
        </Link>
      )}
    </>
  )

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/?q=${encodeURIComponent(query.trim())}`)
  }

  const handleSignOut = async () => {
    await signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 h-20 bg-background/80 backdrop-blur-2xl border-b border-border">
      <div className="mx-auto h-full max-w-[1400px] px-6 flex items-center justify-between gap-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle>{siteName}</SheetTitle>
              </SheetHeader>
              <form onSubmit={onSearch} className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="pl-9 rounded-xl"
                />
              </form>
              <nav className="mt-6 flex flex-col gap-4" onClick={() => setOpen(false)}>
                {navLinks}
              </nav>
              <div className="mt-6 border-t border-border pt-4">
                {user ? (
                  <div className="flex flex-col gap-3">
                    <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                    <Button variant="outline" onClick={handleSignOut}>
                      <LogOut /> Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" asChild onClick={() => setOpen(false)}>
                      <Link to="/login">Sign In</Link>
                    </Button>
                    <Button asChild onClick={() => setOpen(false)}>
                      <Link to="/register">Join Free</Link>
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm">
                <Zap className="size-5" />
              </span>
            )}
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              {siteName}
            </span>
          </Link>
        </div>

        {/* Center: Nav */}
        <nav className="hidden lg:flex items-center gap-6">{navLinks}</nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          <form onSubmit={onSearch} className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-9 w-64 rounded-xl border border-border"
            />
          </form>

          <ThemeToggle />

          {user && <NotificationBell />}

          {user ? (
            <>
              <Link
                to="/profile"
                className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-sm font-semibold"
                aria-label="Profile"
              >
                {(user.email?.[0] ?? 'U').toUpperCase()}
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                <LogOut />
              </Button>
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="secondary" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild>
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
