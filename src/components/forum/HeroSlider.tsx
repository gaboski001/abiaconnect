import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { SlideCard, type HeroSlideLike } from './SlideCard'

/** `compact` is a shorter banner, for the dashboard and other busy screens. */
export function HeroSlider({ compact }: { compact?: boolean }) {
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
    badge_text: '✦ Connecting Abia State Worldwide',
    // Aba Main Park from above (scripts/banners/make_hero_backgrounds.py)
    image_url: '/banners/hero-welcome.webp',
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

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('hero-slides-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hero_slides' },
        () => queryClient.invalidateQueries({ queryKey: ['hero-slides'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Client-side safety filter for expiry
  const now = new Date()
  const activeFetched = (fetched ?? []).filter((s) => {
    if (!s.is_active) return false
    if (!s.expires_at) return true
    return new Date(s.expires_at) > now
  })

  // Slides with order 0 or less (e.g. a launch banner) come before the welcome slide.
  const pinned = activeFetched.filter((s) => (s.order ?? 1) <= 0)
  const rest = activeFetched.filter((s) => (s.order ?? 1) > 0)
  const allSlides: HeroSlideLike[] = [...pinned, defaultSlide, ...rest]

  if (allSlides.length === 1) {
    return (
      <section aria-label="Hero">
        <SlideCard slide={allSlides[0]} compact={compact} />
      </section>
    )
  }

  return <HeroCarousel slides={allSlides} compact={compact} />
}

function HeroCarousel({ slides, compact }: { slides: HeroSlideLike[]; compact?: boolean }) {
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
  const isMobile =
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  const effectiveMs = (isMobile ? intervalSeconds * 2 : intervalSeconds) * 1000

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current)
      autoplayRef.current = null
    }
  }, [])

  const startAutoplay = useCallback(() => {
    stopAutoplay()
    if (prefersReduced) return
    if (slides.length <= 1) return
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
    <section
      role="region"
      aria-label="Hero announcements"
      className="relative w-full"
    >
      <div ref={emblaRef} className="overflow-hidden rounded-[32px]">
        <div className="flex">
          {slides.map((slide, idx) => (
            <div
              key={slide.id ?? idx}
              className="flex-[0_0_100%] min-w-0"
              aria-current={idx === selectedIndex ? 'true' : undefined}
            >
              <SlideCard slide={slide} compact={compact} />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => handleNav('prev')}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 hidden sm:flex w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 text-white items-center justify-center hover:bg-black/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => handleNav('next')}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 hidden sm:flex w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 text-white items-center justify-center hover:bg-black/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              emblaApi?.scrollTo(index)
              stopAutoplay()
              setTimeout(startAutoplay, 8000)
            }}
            className={`transition-all duration-300 rounded-full ${
              index === selectedIndex
                ? 'w-6 h-2 bg-secondary'
                : 'w-2 h-2 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <div className="absolute top-4 right-4 z-10 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white/80 font-medium">
        {selectedIndex + 1} / {slides.length}
      </div>
    </section>
  )
}

export default HeroSlider
