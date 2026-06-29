import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { useThrottledCallback } from '@/hooks/useThrottledCallback'

import { useSiteSettings } from '@/hooks/useSiteSettings'
import { GOLD_GRADIENT, GOLD_SHADOW, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'
import { SlideCard, type HeroSlideLike } from './SlideCard'

export function HeroSlider() {
  const queryClient = useQueryClient()
  const { settings } = useSiteSettings()

  const defaultSlide: HeroSlideLike = {
    id: 'default',
    title: settings.site_name || 'AbiaConnect',
    subtitle: 'Indigenous Unity.',
    body:
      settings.site_tagline ||
      'Connecting Abia State indigenes worldwide — trade, culture, community, and opportunity.',
    cta_label: 'Start a Discussion',
    cta_url: '/create-thread',
    cta_label_2: 'Visit Our Store',
    cta_url_2: settings.store_link || '#',
    bg_color_from: '#013220',
    bg_color_to: '#000000',
    badge_text: 'Connecting Abia State Worldwide',
    image_url: null,
    isDefault: true,
  }

  const { data: fetched } = useQuery({
    queryKey: ['hero-slides'],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('order', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    const channel = supabase.channel(`hero-slides-updates-${Math.random().toString(36).slice(2)}`)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'hero_slides' },
      () => queryClient.invalidateQueries({ queryKey: ['hero-slides'] }),
    )
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const now = new Date()
  const activeFetched = (fetched ?? []).filter((s) => {
    if (!s.is_active) return false
    if (!s.expires_at) return true
    return new Date(s.expires_at) > now
  })

  const allSlides: HeroSlideLike[] = [defaultSlide, ...activeFetched]

  return (
    <section
      aria-label="Featured updates"
      className="rounded-[2rem] border border-slate-200/80 bg-white/96 p-4 sm:p-5 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)]"
      style={{ boxShadow: PREMIUM_SHADOW }}
    >
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" style={{ color: MOBILE_BRAND.gold }} />
          <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            AbiaConnect Spotlight
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300/74">
          Featured discussions, announcements and events from across Abia State and the diaspora.
        </p>
      </div>

      {allSlides.length === 1 ? <SingleSlide slide={allSlides[0]} /> : <HeroCarousel slides={allSlides} />}
    </section>
  )
}

function SingleSlide({ slide }: { slide: HeroSlideLike }) {
  return (
    <div className="overflow-hidden rounded-[2rem]">
      <SlideCard slide={slide} />
    </div>
  )
}

function HeroCarousel({ slides }: { slides: HeroSlideLike[] }) {
  const { settings } = useSiteSettings()
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    skipSnaps: false,
    dragFree: false,
    duration: prefersReduced ? 0 : 25,
  })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const intervalSeconds = Number(settings.hero_slide_interval_seconds) || 6
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false
  const effectiveMs = (isMobile ? intervalSeconds * 2 : intervalSeconds) * 1000

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current)
      autoplayRef.current = null
    }
  }, [])

  const startAutoplay = useCallback(() => {
    stopAutoplay()
    if (prefersReduced || slides.length <= 1) return
    autoplayRef.current = setInterval(() => {
      emblaApi?.scrollNext()
    }, effectiveMs)
  }, [emblaApi, slides.length, effectiveMs, prefersReduced, stopAutoplay])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    startAutoplay()
    const pause = () => stopAutoplay()
    const resume = () => setTimeout(startAutoplay, 8000)
    emblaApi.on('pointerDown', pause)
    emblaApi.on('pointerUp', resume)
    return () => {
      stopAutoplay()
      emblaApi.off('pointerDown', pause)
      emblaApi.off('pointerUp', resume)
    }
  }, [emblaApi, startAutoplay, stopAutoplay])

  const handleNav = (dir: 'prev' | 'next') => {
    if (!emblaApi) return
    dir === 'prev' ? emblaApi.scrollPrev() : emblaApi.scrollNext()
    stopAutoplay()
    setTimeout(startAutoplay, 8000)
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full">
        <div ref={emblaRef} className="overflow-hidden rounded-[2rem]">
          <div className="flex">
            {slides.map((slide, idx) => (
              <div
                key={slide.id ?? idx}
                className="min-w-0 flex-[0_0_100%]"
                aria-current={idx === selectedIndex ? 'true' : undefined}
              >
                <SlideCard slide={slide} />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleNav('prev')}
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => handleNav('next')}
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs font-medium text-white/86 backdrop-blur-sm">
          {selectedIndex + 1} / {slides.length}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {slides.map((slide, idx) => {
            const active = idx === selectedIndex
            return (
              <button
                key={slide.id ?? idx}
                type="button"
                onClick={() => emblaApi?.scrollTo(idx)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                style={
                  active
                    ? { backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW, color: MOBILE_BRAND.ink, borderColor: 'transparent' }
                    : undefined
                }
              >
                <span className={active ? '' : 'text-slate-600 dark:text-slate-300/78'}>
                  {slide.badge_text || slide.title}
                </span>
              </button>
            )
          })}
        </div>

      </div>

    </div>
  )
}

export default HeroSlider
