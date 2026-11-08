import { useEffect, useState } from 'react'
import { canDonateHere } from '@/lib/storePolicy'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { ArrowRight, ChevronUp, Download, MessagesSquare, ShieldCheck, Users, Vote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useCommunityStats } from '@/hooks/useCommunityStats'
import { SiteLogo } from './SiteLogo'

const LINK_GROUPS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'Community',
    links: [
      { label: 'Forums', href: '/' },
      { label: 'Groups', href: '/subgroups' },
      { label: 'Polls', href: '/polls' },
      { label: 'Contests & elections', href: '/contests' },
      { label: 'Events', href: '/events' },
    ],
  },
  {
    title: 'AbiaConnect',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Our mission', href: '/mission' },
      { label: 'Our team', href: '/team' },
      { label: 'Success stories', href: '/success-stories' },
      { label: 'Member spotlight', href: '/member-spotlight' },
      { label: 'Events', href: '/events' },
      { label: 'Volunteer', href: '/volunteer' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Help centre', href: '/help' },
      { label: 'Report a problem', href: '/report-issue' },
      { label: 'Forum guidelines', href: '/forum-guidelines' },
      { label: 'Community standards', href: '/community-standards' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Terms of service', href: '/terms-of-service' },
      { label: 'Cookie policy', href: '/cookie-policy' },
      { label: 'Photo credits', href: '/photo-credits' },
    ],
  },
]

export function Footer() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  const [showTop, setShowTop] = useState(false)
  const { user } = useAuth()
  const { settings } = useSiteSettings()
  const tagline = settings.site_tagline || 'Connecting Abians Worldwide'
  const stats = useCommunityStats()

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const facts = [
    { icon: MessagesSquare, value: stats.data?.discussions, label: 'discussions' },
    { icon: Users, value: stats.data?.groups, label: 'community groups' },
    { icon: Vote, value: stats.data?.topics, label: 'forum topics' },
  ]

  return (
    <>
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-0 left-0 right-0 h-1 origin-left z-[60] bg-gradient-to-r from-primary to-secondary"
      />

      <footer className="mt-16 border-t border-border bg-muted/40">
        {/* Call to action band */}
        <div className="brand-panel border-b border-border">
          <div className="mx-auto flex max-w-[1248px] flex-col items-start justify-between gap-5 px-6 py-8 md:flex-row md:items-center">
            <div>
              <p className="web-serif text-2xl font-semibold">
                {user ? 'Have something to share with Abians?' : 'Join the conversation.'}
              </p>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {user
                  ? 'Start a discussion, vote in a poll, or check in for today’s reward.'
                  : 'Free to join. Meet Abians at home and abroad, share ideas and grow together.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild variant="secondary" className="h-11 rounded-full px-5 font-semibold">
                <Link to={user ? '/create-thread' : '/register'}>
                  {user ? 'Start a discussion' : 'Create a free account'} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-primary-foreground/30 bg-transparent px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/download">
                  <Download className="size-4" /> Get the app
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1248px] px-6 py-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
            {/* Brand + live facts */}
            <div className="space-y-5">
              <Link to="/" aria-label="AbiaConnect home" className="inline-flex">
                <SiteLogo imageClassName="h-12 max-w-[200px]" />
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                {tagline}. The trusted digital home for indigenous Abians, at home and across the world.
              </p>
              <ul className="space-y-2">
                {facts.map(({ icon: Icon, value, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm">
                    <Icon className="size-4 text-primary" aria-hidden />
                    <span>
                      <span className="font-semibold text-foreground">{value == null ? '—' : value.toLocaleString()}</span>{' '}
                      <span className="text-muted-foreground">{label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Link columns */}
            <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {LINK_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</h3>
                  <ul className="space-y-2.5">
                    {group.links.map((l) => (
                      <li key={l.label}>
                        <Link to={l.href} className="text-sm text-foreground/80 transition-colors hover:text-primary hover:underline">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row">
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" aria-hidden /> © {new Date().getFullYear()} AbiaConnect. A registered community platform.
            </p>
            <div className="flex items-center gap-4">
              {canDonateHere() && (
                <Link to="/donate" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
                  Support AbiaConnect
                </Link>
              )}
              <a
                href="https://wa.me/2348103428888"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contact us on WhatsApp"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                  <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.08.54 4.1 1.57 5.89L0 24l6.42-1.68a11.83 11.83 0 0 0 5.62 1.43h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.43Zm-8.48 18.02h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.81 1 1.02-3.71-.23-.38a9.66 9.66 0 1 1 17.93-5.01c0 5.33-4.34 9.66-9.63 9.66Z" />
                </svg>
              </a>
            </div>
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
