import { Link } from 'react-router-dom'
import type { Database } from '@/integrations/supabase/types'

type HeroSlideRow = Database['public']['Tables']['hero_slides']['Row']

export type HeroSlideLike = Partial<HeroSlideRow> & {
  id?: string
  title: string
  subtitle?: string | null
  body?: string | null
  badge_text?: string | null
  cta_label?: string | null
  cta_url?: string | null
  cta_label_2?: string | null
  cta_url_2?: string | null
  bg_color_from?: string | null
  bg_color_to?: string | null
  image_url?: string | null
  isDefault?: boolean
}

function SlideLink({
  href,
  className,
  children,
}: {
  href: string
  className: string
  children: React.ReactNode
}) {
  const isExternal = href.startsWith('http') || href.startsWith('//')
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

export function SlideCard({ slide }: { slide: HeroSlideLike }) {
  const from = slide.bg_color_from || '#013220'
  const to = slide.bg_color_to || '#000000'
  const bgStyle = { background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }

  return (
    <div
      className="relative w-full rounded-[32px] overflow-hidden border-2 border-secondary/20 min-h-[380px] md:min-h-[460px] flex flex-col items-center justify-center px-6 py-10 md:py-16 text-center"
      style={bgStyle}
    >
      {slide.image_url && (
        <img
          src={slide.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 pointer-events-none" />

      {slide.isDefault && (
        <>
          <div
            aria-hidden
            className="absolute top-0 right-0 w-64 h-64 rounded-full bg-secondary/20 blur-[80px] pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-primary/30 blur-[60px] pointer-events-none"
          />
        </>
      )}

      <div className="relative z-10 max-w-2xl mx-auto space-y-4">
        {slide.badge_text && (
          <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-secondary/40 bg-secondary/10 text-secondary text-xs font-semibold uppercase tracking-wider">
            {slide.badge_text}
          </div>
        )}

        <h2 className="text-3xl md:text-5xl font-bold leading-tight">
          {slide.isDefault ? (
            <>
              <span className="text-white">{slide.title}</span>
              {slide.subtitle && (
                <>
                  <br />
                  <span className="text-gold-gradient">
                    {slide.subtitle}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-white">{slide.title}</span>
          )}
        </h2>

        {slide.body && (
          <p className="text-white/80 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            {slide.body}
          </p>
        )}

        {!slide.isDefault && slide.subtitle && (
          <p className="text-secondary font-semibold text-sm md:text-base">{slide.subtitle}</p>
        )}

        {(slide.cta_label || slide.cta_label_2) && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {slide.cta_label && slide.cta_url && (
              <SlideLink
                href={slide.cta_url}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gold text-black hover:opacity-90 transition-opacity shadow-[0_8px_30px_-8px_rgba(245,200,80,0.7)]"
              >
                {slide.cta_label}
              </SlideLink>
            )}
            {slide.cta_label_2 && slide.cta_url_2 && (
              <SlideLink
                href={slide.cta_url_2}
                className="px-6 py-2.5 rounded-xl font-semibold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                {slide.cta_label_2}
              </SlideLink>
            )}
          </div>
        )}

        {!slide.isDefault && (
          <p className="text-white/30 text-[10px] uppercase tracking-widest mt-2">
            Advertisement
          </p>
        )}
      </div>
    </div>
  )
}

export default SlideCard
