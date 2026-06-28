import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { toast } from 'sonner'
import {
  ChevronRight,
  ChevronUp,
  HeartHandshake,
  Mail,
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
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

const STATS = [
  { icon: Users, label: '10,000+ Active Members' },
  { icon: Sparkles, label: '500+ Success Stories' },
  { icon: HeartHandshake, label: '24/7 Community Support' },
  { icon: ShieldCheck, label: 'Safe, trusted interactions' },
]

const LINK_GROUPS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'About',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Our Mission', href: '/mission' },
      { label: 'Meet the Team', href: '/team' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Forum Guidelines', href: '/forum-guidelines' },
      { label: 'Events Calendar', href: '/events' },
      { label: 'Success Stories', href: '/success-stories' },
      { label: 'Member Spotlight', href: '/member-spotlight' },
      { label: 'Support the Platform ❤️', href: '/donate' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Report an Issue', href: '/report-issue' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Service', href: '/terms-of-service' },
      { label: 'Cookie Policy', href: '/cookie-policy' },
      { label: 'Community Standards', href: '/community-standards' },
    ],
  },
]

export function Footer() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  const [showTop, setShowTop] = useState(false)
  const [email, setEmail] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'
  const tagline = settings.site_tagline || 'Connecting Abians Worldwide'
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const showLogoImage = !!logoUrl && !logoFailed

  useEffect(() => {
    setLogoFailed(false)
  }, [settings.site_logo, settings.logo_url, logoUrl])

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
        className="fixed left-0 right-0 top-0 z-[60] h-1 origin-left"
        aria-hidden
      >
        <div className="h-full w-full" style={{ backgroundImage: GOLD_GRADIENT }} />
      </motion.div>

      <footer className="mt-14 border-t border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(255,255,255,1)_100%)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(5,10,18,0.98)_0%,rgba(8,14,26,1)_100%)]">
        <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-10 sm:px-6 sm:py-12">
          <section
            className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/96 p-5 sm:p-6 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)]"
            style={{ boxShadow: PREMIUM_SHADOW }}
          >
            <div className="absolute inset-0 opacity-80 dark:opacity-100" style={{ background: 'radial-gradient(circle at top right, rgba(248,195,1,0.18), transparent 34%), radial-gradient(circle at bottom left, rgba(28,169,217,0.16), transparent 36%)' }} />
            <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/82"
                  style={{ background: GOLD_GRADIENT_SOFT }}
                >
                  <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                  Community footer, upgraded
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] border border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-white/[0.06]">
                    {showLogoImage ? (
                      <SafeImage
                        src={logoUrl}
                        fallback=""
                        alt={siteName}
                        className="h-9 w-auto max-w-[120px] object-contain"
                        onError={() => setLogoFailed(true)}
                      />
                    ) : (
                      <span className="text-lg font-black" style={{ color: MOBILE_BRAND.goldWarm }}>
                        AC
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{siteName}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300/74">{tagline}</p>
                  </div>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-700 dark:text-slate-300/78">
                  Stay close to the conversations, events, culture, and people shaping the AbiaConnect community. The refreshed footer keeps important links, support paths, and updates easy to find on every screen.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {STATS.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 p-4 text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
                      <Icon className="size-4.5" />
                    </span>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-100">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div
              className="rounded-[2rem] border border-slate-200/80 bg-white/96 p-5 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)]"
              style={{ boxShadow: PREMIUM_SHADOW }}
            >
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {LINK_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900 dark:text-white">
                      {group.title}
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {group.links.map((l) => (
                        <li key={l.label}>
                          <Link
                            to={l.href}
                            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950 dark:text-slate-300/78 dark:hover:text-white"
                          >
                            <ChevronRight className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-[2rem] border border-slate-200/80 bg-white/96 p-5 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)]"
              style={{ boxShadow: PREMIUM_SHADOW }}
            >
              <div
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/82"
                style={{ background: GOLD_GRADIENT_SOFT }}
              >
                <Mail className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                Newsletter
              </div>
              <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950 dark:text-white">Receive trusted community updates</h3>
              <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300/76">
                Get highlights on discussions, events, and platform improvements straight in your inbox.
              </p>
              <form onSubmit={onSubscribe} className="mt-5 space-y-3">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200/80 bg-white text-slate-950 placeholder:text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-400"
                />
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl border-0 font-bold text-slate-950"
                  style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                >
                  Subscribe for updates
                </Button>
              </form>
              <div className="mt-5 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.05]">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl text-slate-950" style={{ backgroundImage: GOLD_GRADIENT }}>
                    <Zap className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Faster access to support</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300/74">
                      Need to reach the team? Visit Help, Report an Issue, or support the platform from one place.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between dark:border-white/10 dark:text-slate-300/72">
            <p>© {new Date().getFullYear()} AbiaConnect. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://wa.me/2348103428888"
                target="_blank"
                rel="noopener noreferrer"
                title="Contact Project Manager"
                aria-label="Contact Project Manager on WhatsApp"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:hover:bg-white/[0.07]"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: '#25D366' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                    <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.08.54 4.1 1.57 5.89L0 24l6.42-1.68a11.83 11.83 0 0 0 5.62 1.43h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.43Zm-8.48 18.02h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.81 1 1.02-3.71-.23-.38a9.66 9.66 0 1 1 17.93-5.01c0 5.33-4.34 9.66-9.63 9.66Z" />
                  </svg>
                </span>
                Contact support
              </a>
              <span>Made with ❤️ for Abia State</span>
            </div>
          </div>
        </div>
      </footer>

      {showTop && (
        <Button
          size="icon"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 rounded-full border-0 text-slate-950"
          style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
        >
          <ChevronUp className="size-5" />
        </Button>
      )}
    </>
  )
}

export default Footer
