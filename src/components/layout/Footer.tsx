import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { toast } from 'sonner'
import {
  ChevronUp,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SafeImage } from '@/components/ui/SafeImage'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'

const STATS = [
  { icon: Users, label: '10,000+ Active Members' },
  { icon: Sparkles, label: '500+ Success Stories' },
  { icon: HeartHandshake, label: '24/7 Community Support' },
  { icon: ShieldCheck, label: '100% Safe & Secure' },
]

const LINK_GROUPS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'About',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Mission', href: '/mission' },
      { label: 'Team', href: '/team' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Forum Guidelines', href: '/guidelines' },
      { label: 'Events Calendar', href: '/events' },
      { label: 'Success Stories', href: '/stories' },
      { label: 'Member Spotlight', href: '/spotlight' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'API Docs', href: '/docs/api' },
      { label: 'Developer Portal', href: '/developers' },
      { label: 'Report an Issue', href: '/report' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Community Standards', href: '/standards' },
    ],
  },
]

export function Footer() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  const [showTop, setShowTop] = useState(false)
  const [email, setEmail] = useState('')
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'
  const tagline = settings.site_tagline || 'Connecting Abians Worldwide'
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    toast.success("Subscribed! You'll hear from us soon.")
    setEmail('')
  }

  return (
    <>
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 h-1 origin-left z-[60] bg-gradient-to-r from-primary to-secondary"
      />

      <footer className="mt-12 bg-primary/5 border-t border-border">
        <div className="mx-auto max-w-[1400px] px-6 py-12 space-y-12">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            {logoUrl ? (
              <SafeImage
                src={logoUrl}
                fallback=""
                alt={siteName}
                className="h-12 w-auto max-w-[180px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl text-foreground">{siteName}</span>
              </div>
            )}
            <p className="text-muted-foreground text-sm max-w-[240px] leading-relaxed">
              {tagline}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* Link grid + newsletter */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {LINK_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="font-semibold mb-3">{group.title}</h3>
                <ul className="space-y-2">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.href}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="col-span-2 md:col-span-3 lg:col-span-1">
              <h3 className="font-semibold mb-3">Newsletter</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Get community updates straight to your inbox.
              </p>
              <form onSubmit={onSubscribe} className="flex flex-col gap-2">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                />
                <Button type="submit">Subscribe</Button>
              </form>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} AbiaConnect. All rights reserved.</p>
            <p>Made with ❤️ for Abia State</p>
          </div>
        </div>
      </footer>

      {showTop && (
        <Button
          size="icon"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
        >
          <ChevronUp />
        </Button>
      )}
    </>
  )
}

export default Footer
