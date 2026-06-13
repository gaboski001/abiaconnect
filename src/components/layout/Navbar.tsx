import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Search } from 'lucide-react'
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
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { SafeImage } from '@/components/ui/SafeImage'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { RealtimeStatus } from '@/components/RealtimeStatus'
import { MessagesBell } from '@/components/messages/MessagesBell'

export function Navbar() {
  const navigate = useNavigate()
  const { user, role, isAdmin, signOut } = useAuth()
  const { settings } = useSiteSettings()
  const { data: profile } = useProfile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)

  const siteName = settings.site_name || 'AbiaConnect'
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const showLogoImage = !!logoUrl && !logoFailed
  const subgroupsEnabled = settings.global_subgroups_enabled !== 'false'
  const storeLink = settings.store_link

  useEffect(() => {
    setLogoFailed(false)
  }, [settings.site_logo, settings.logo_url, logoUrl])


  const navLinks = (
    <>
      <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
        Forums
      </Link>
      <Link to="/polls" className="text-sm font-medium hover:text-primary transition-colors">
        Polls
      </Link>
      <Link to="/about" className="text-sm font-medium hover:text-primary transition-colors">
        About Us
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
                <SheetTitle asChild>
                  <Link to="/" onClick={() => setOpen(false)} className="flex items-center" aria-label={siteName}>
                    {showLogoImage && (
                      <img
                        src={logoUrl as string}
                        alt={siteName}
                        onError={() => setLogoFailed(true)}
                        className="h-10 w-auto max-w-[180px] object-contain"
                      />
                    )}
                  </Link>
                </SheetTitle>
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

          <Link to="/" className="flex items-center" aria-label={siteName}>
            {showLogoImage && (
              <img
                src={logoUrl as string}
                alt={siteName}
                onError={() => setLogoFailed(true)}
                className="h-10 w-auto max-w-[180px] object-contain"
              />
            )}
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

          <RealtimeStatus className="hidden md:inline-flex" />

          {user ? (
            <>
              <MessagesBell />
              <NotificationBell />
              <Link to="/profile" aria-label="Profile" className="flex">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  displayName={profile?.display_name || user.email}
                  size="sm"
                  className="border-0"
                />
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
