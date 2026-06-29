import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronUp, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SafeImage } from '@/components/ui/SafeImage'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND } from '@/lib/mobileBrand'

const LINK_GROUPS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: 'About',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Our Mission', href: '/mission' },
      { label: 'Team', href: '/team' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Guidelines', href: '/forum-guidelines' },
      { label: 'Events', href: '/events' },
      { label: 'Success Stories', href: '/success-stories' },
      { label: 'Donate ❤️', href: '/donate' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Report Issue', href: '/report-issue' },
      { label: 'Version', href: '/version' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy-policy' },
      { label: 'Terms', href: '/terms-of-service' },
      { label: 'Cookies', href: '/cookie-policy' },
      { label: 'Standards', href: '/community-standards' },
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

      <footer className="mt-12 border-t border-slate-200/80 bg-white dark:border-white/10 dark:bg-[rgba(8,14,26,1)]">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
          {/* Compact grid: brand + 4 link cols + newsletter */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:grid-cols-6 md:gap-8 lg:grid-cols-12">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-4 md:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 dark:border-white/10 dark:bg-white/[0.06]">
                  {showLogoImage ? (
                    <SafeImage
                      src={logoUrl}
                      fallback=""
                      alt={siteName}
                      className="h-7 w-auto max-w-[90px] object-contain"
                      onError={() => setLogoFailed(true)}
                    />
                  ) : (
                    <span className="text-sm font-black" style={{ color: MOBILE_BRAND.goldWarm }}>AC</span>
                  )}
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-950 dark:text-white">{siteName}</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{tagline}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-400">
                The home of Abia conversations — culture, news, events and the 17 LGAs.
              </p>
            </div>

            {/* Link columns */}
            {LINK_GROUPS.map((group) => (
              <div key={group.title} className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-2">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-900 dark:text-white">
                  {group.title}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.href}
                        className="text-xs font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Newsletter */}
            <div className="md:col-span-6 lg:col-span-1 lg:hidden xl:hidden" aria-hidden />
            <div className="col-span-2 sm:col-span-4 md:col-span-6 lg:col-span-1">
              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-900 dark:text-white">
                <Mail className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                Newsletter
              </h3>
              <form onSubmit={onSubscribe} className="mt-3 flex gap-2">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 flex-1 rounded-lg border-slate-200/80 bg-white text-xs text-slate-950 placeholder:text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
                />
                <Button
                  type="submit"
                  className="h-9 rounded-lg border-0 px-3 text-xs font-bold text-slate-950"
                  style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                >
                  Join
                </Button>
              </form>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:text-slate-400">
            <p>© {new Date().getFullYear()} AbiaConnect — Made with ❤️ for Abia State.</p>
            <a
              href="https://wa.me/2348103428888"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: '#25D366' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3" aria-hidden="true">
                  <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.08.54 4.1 1.57 5.89L0 24l6.42-1.68a11.83 11.83 0 0 0 5.62 1.43h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.43Zm-8.48 18.02h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.81 1 1.02-3.71-.23-.38a9.66 9.66 0 1 1 17.93-5.01c0 5.33-4.34 9.66-9.63 9.66Z" />
                </svg>
              </span>
              Contact support
            </a>
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
