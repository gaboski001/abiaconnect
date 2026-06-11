import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { CategoryList } from '@/components/forum/CategoryList'
import { SidebarWidgets } from '@/components/forum/SidebarWidgets'

const AVATAR_COLORS = [
  'from-emerald-400 to-emerald-700',
  'from-amber-300 to-amber-600',
  'from-cyan-400 to-blue-600',
  'from-rose-400 to-rose-700',
  'from-violet-400 to-violet-700',
]

export default function Home() {
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'
  const tagline = settings.site_tagline || 'Connecting Abians Worldwide'
  const storeLink = settings.store_link || '#'

  return (
    <div className="space-y-12">
      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[32px] border-2 border-secondary/20 bg-gradient-to-br from-[#013220] via-[#012215] to-black px-6 py-16 md:py-24 text-center shadow-[0_0_80px_-20px_rgba(212,168,76,0.45)]"
      >
        {/* carbon fiber texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 4px)',
          }}
        />
        {/* orbs */}
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary/40 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/50 blur-3xl"
        />

        <div className="relative max-w-3xl mx-auto flex flex-col items-center gap-6">
          <span className="inline-block rounded-full border border-secondary/60 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            ✦ Connecting Abia State Worldwide
          </span>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight text-white">
            {siteName}
            <br />
            <span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 bg-clip-text text-transparent">
              Indigenous Unity.
            </span>
          </h1>

          <p className="max-w-xl text-gray-400 text-base md:text-lg">{tagline}</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black hover:opacity-90 shadow-[0_8px_30px_-8px_rgba(245,200,80,0.7)]"
            >
              <Link to="/create-thread">Start a Discussion</Link>
            </Button>
            <Button asChild variant="outline" className="border-secondary/50 text-white hover:bg-white/10">
              <a href={storeLink} target="_blank" rel="noopener noreferrer">
                Visit Our Store
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex -space-x-3">
              {AVATAR_COLORS.map((c, i) => (
                <span
                  key={i}
                  className={`h-9 w-9 rounded-full bg-gradient-to-br ${c} ring-2 ring-black`}
                />
              ))}
            </div>
            <span className="ml-2 rounded-full bg-white/10 text-white text-xs font-semibold px-3 py-1">
              +2k members
            </span>
          </div>
        </div>
      </motion.section>

      {/* CATEGORIES + SIDEBAR */}
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <CategoryList />
        </div>
        <div className="lg:col-span-4">
          <SidebarWidgets />
        </div>
      </div>
    </div>
  )
}
