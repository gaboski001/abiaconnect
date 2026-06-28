import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import type { Database } from '@/integrations/supabase/types'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, MOBILE_BRAND } from '@/lib/mobileBrand'

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
  style,
  children,
}: {
  href: string
  className: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const isExternal = href.startsWith('http') || href.startsWith('//')
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className} style={style}>
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
      className="relative flex min-h-[400px] w-full overflow-hidden rounded-[32px] border border-white/15 px-6 py-8 text-left text-white md:min-h-[470px] md:px-8 md:py-10"
      style={bgStyle}
    >
      {slide.image_url && (
        <img
          src={slide.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(5,12,22,0.84)_15%,rgba(5,12,22,0.55)_55%,rgba(5,12,22,0.82)_100%)]" />
      <div className="absolute -right-16 top-0 h-56 w-56 rounded-full blur-3xl" style={{ background: 'rgba(248,195,1,0.16)' }} />
      <div className="absolute -left-12 bottom-0 h-48 w-48 rounded-full blur-3xl" style={{ background: 'rgba(28,169,217,0.18)' }} />

      <div className="relative z-10 grid w-full gap-8 lg:items-end">

        <div className="flex max-w-2xl flex-col justify-between gap-5">
          <div className="space-y-4">
            {slide.badge_text && (
              <div
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/88"
                style={{ background: GOLD_GRADIENT_SOFT }}
              >
                <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                {slide.badge_text}
              </div>
            )}

            <h2 className="text-3xl font-black leading-tight md:text-5xl">
              {slide.isDefault ? (
                <>
                  <span className="text-white">{slide.title}</span>
                  {slide.subtitle ? (
                    <>
                      <br />
                      <span className="bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
                        {slide.subtitle}
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <span className="text-white">{slide.title}</span>
              )}
            </h2>

            {slide.body ? (
              <p className="max-w-xl text-base leading-8 text-white/82 md:text-lg">{slide.body}</p>
            ) : null}

            {!slide.isDefault && slide.subtitle ? (
              <p className="text-sm font-semibold text-white/86 md:text-base">{slide.subtitle}</p>
            ) : null}
          </div>

          {(slide.cta_label || slide.cta_label_2) && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {slide.cta_label && slide.cta_url ? (
                <SlideLink
                  href={slide.cta_url}
                  className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-slate-950 transition-opacity hover:opacity-95"
                  style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
                >
                  {slide.cta_label}
                  <ArrowUpRight className="size-4" />
                </SlideLink>
              ) : null}
              {slide.cta_label_2 && slide.cta_url_2 ? (
                <SlideLink
                  href={slide.cta_url_2}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.10]"
                >
                  {slide.cta_label_2}
                </SlideLink>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {!slide.isDefault && (
        <p className="absolute bottom-5 right-6 z-10 text-[10px] uppercase tracking-[0.22em] text-white/45">
          Sponsored update
        </p>
      )}
    </div>
  )
}


export default SlideCard
