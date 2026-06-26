import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import useEmblaCarousel from 'embla-carousel-react';
import {
  MessagesSquare,
  Users,
  Bell,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Zap,
  Rocket,
  Globe2,
  Heart,
  Sparkles,
  Target,
  Eye,
  HandHeart,
} from 'lucide-react';

interface MobileOnboardingProps {
  onFinish: () => void;
}

// Brand palette — forest green + gold, locked for the onboarding canvas.
const BRAND = {
  bg: '#0D0D0D',
  surface: '#1E1E1E',
  surfaceAlt: '#141414',
  border: '#2A2A2A',
  gold: '#C8A951',
  goldDark: '#8A7A3A',
  green: '#1B3D1B',
  greenDark: '#013220',
  text: '#FFFFFF',
  textMuted: '#B0B0B0',
  textDim: '#707070',
};

/** Drifting gold particles in the background — pure CSS/Motion, no canvas. */
const Particles = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        size: 2 + Math.random() * 4,
        x: Math.random() * 100,
        y: Math.random() * 100,
        duration: 8 + Math.random() * 10,
        delay: Math.random() * 6,
      })),
    []
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: BRAND.gold,
            boxShadow: `0 0 ${p.size * 4}px ${BRAND.gold}`,
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0.15, 0.6, 0.15],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

type SlideType = 'welcome' | 'about' | 'features' | 'start';

interface BaseSlide {
  id: number;
  type: SlideType;
}
interface WelcomeSlide extends BaseSlide {
  type: 'welcome';
  tagline: string;
  subtitle: string;
}
interface AboutSlide extends BaseSlide {
  type: 'about';
  title: string;
  cards: { icon: typeof Target; label: string; body: string }[];
}
interface FeaturesSlide extends BaseSlide {
  type: 'features';
  title: string;
  features: { icon: typeof MessagesSquare; name: string; desc: string }[];
}
interface StartSlide extends BaseSlide {
  type: 'start';
  title: string;
  subtitle: string;
}
type Slide = WelcomeSlide | AboutSlide | FeaturesSlide | StartSlide;

export const MobileOnboarding = ({ onFinish }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, duration: 24 });
  const [currentSlide, setCurrentSlide] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const slides: Slide[] = [
    {
      id: 1,
      type: 'welcome',
      tagline: settings.site_tagline || 'Connect, Communicate, Collaborate',
      subtitle: 'One People. One Voice. One Platform.',
    },
    {
      id: 2,
      type: 'about',
      title: 'About AbiaConnect',
      cards: [
        {
          icon: Target,
          label: 'Mission',
          body: 'Bridge home and diaspora so culture, knowledge, commerce and community thrive together.',
        },
        {
          icon: Eye,
          label: 'Vision',
          body: 'Geography should never separate a people from their identity, community, or voice.',
        },
        {
          icon: HandHeart,
          label: 'Values',
          body: 'Integrity, unity, progress — for every indigenous Abian, anywhere in the world.',
        },
      ],
    },
    {
      id: 3,
      type: 'features',
      title: 'Everything you need',
      features: [
        { icon: MessagesSquare, name: 'Forums', desc: '14 categories of structured talk' },
        { icon: Users, name: 'Subgroups', desc: 'LGA, profession, interest' },
        { icon: Zap, name: 'Live Polls', desc: 'Real-time community pulse' },
        { icon: Bell, name: 'Smart Alerts', desc: 'Never miss what matters' },
        { icon: Heart, name: 'Direct Chat', desc: 'Connect one-on-one' },
        { icon: Globe2, name: 'Worldwide', desc: 'Diaspora-first design' },
      ],
    },
    {
      id: 4,
      type: 'start',
      title: 'Ready to join?',
      subtitle: 'Join 10,000+ Abians connecting from every corner of the globe.',
    },
  ];

  const handleNext = () => {
    if (emblaApi?.canScrollNext()) emblaApi.scrollNext();
    else handleFinish();
  };
  const handlePrev = () => emblaApi?.scrollPrev();
  const handleFinish = () => {
    try {
      localStorage.setItem('hasSeenOnboarding', 'true');
    } catch {
      /* ignore */
    }
    onFinish();
  };

  const isLast = currentSlide === slides.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden font-sans"
      style={{ background: BRAND.bg, color: BRAND.text }}
      role="dialog"
      aria-label="Welcome to AbiaConnect"
    >
      {/* Layered gradient + particles backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 20% 0%, ${BRAND.green}40 0%, transparent 50%),
                       radial-gradient(ellipse at 80% 100%, ${BRAND.gold}25 0%, transparent 55%),
                       linear-gradient(180deg, ${BRAND.bg} 0%, ${BRAND.surfaceAlt} 100%)`,
        }}
      />
      <Particles />

      {/* Top bar: Skip */}
      <div
        className="relative z-10 flex items-center justify-end px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
      >
        <Button
          variant="ghost"
          onClick={handleFinish}
          className="font-medium hover:bg-white/5"
          style={{ color: BRAND.textMuted }}
          aria-label="Skip onboarding"
        >
          Skip
        </Button>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-hidden relative z-10" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="flex-[0_0_100%] h-full flex flex-col items-center justify-center px-6 text-center relative"
            >
              <AnimatePresence mode="wait">
                {currentSlide === idx && (
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="w-full flex flex-col items-center"
                  >
                    {slide.type === 'welcome' && <WelcomeView slide={slide} />}
                    {slide.type === 'about' && <AboutView slide={slide} />}
                    {slide.type === 'features' && <FeaturesView slide={slide} />}
                    {slide.type === 'start' && (
                      <StartView
                        slide={slide}
                        onCreate={() => {
                          handleFinish();
                          navigate('/register');
                        }}
                        onSignIn={() => {
                          handleFinish();
                          navigate('/login');
                        }}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls: dots + back/next */}
      {!isLast && (
        <div
          className="relative z-10 flex items-center justify-between px-6 pt-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
        >
          {/* Back */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            disabled={currentSlide === 0}
            aria-label="Previous slide"
            className="size-12 rounded-2xl disabled:opacity-0 transition-opacity"
            style={{ color: BRAND.textMuted }}
          >
            <ChevronLeft className="size-5" />
          </Button>

          {/* Dots */}
          <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding progress">
            {slides.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                role="tab"
                aria-selected={currentSlide === i}
                aria-label={`Go to slide ${i + 1}`}
                className="h-2 rounded-full"
                animate={{
                  width: currentSlide === i ? 28 : 8,
                  backgroundColor: currentSlide === i ? BRAND.gold : `${BRAND.gold}40`,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            ))}
          </div>

          {/* Next */}
          <Button
            size="icon"
            onClick={handleNext}
            aria-label="Next slide"
            className="size-12 rounded-2xl shadow-lg group"
            style={{
              background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
              color: BRAND.bg,
              boxShadow: `0 8px 24px -8px ${BRAND.gold}80`,
            }}
          >
            <ChevronRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      )}
    </motion.div>
  );
};

/* ---------- Slide views ---------- */

const WelcomeView = ({ slide }: { slide: WelcomeSlide }) => (
  <>
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="mb-10 relative"
    >
      <motion.div
        className="absolute inset-0 rounded-full blur-3xl scale-150"
        style={{ background: `${BRAND.gold}33` }}
        animate={{ scale: [1.5, 1.8, 1.5], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        className="relative w-44 h-44 flex items-center justify-center"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <img
          src="/email-logo.png"
          alt="AbiaConnect logo"
          className="w-32 h-32 object-contain drop-shadow-2xl"
        />
      </motion.div>
    </motion.div>
    <motion.h1
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="text-4xl font-extrabold mb-3 leading-tight bg-clip-text text-transparent"
      style={{ backgroundImage: `linear-gradient(135deg, ${BRAND.gold} 0%, #F0D78C 100%)` }}
    >
      {slide.tagline}
    </motion.h1>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="text-base max-w-xs mx-auto"
      style={{ color: BRAND.textMuted }}
    >
      {slide.subtitle}
    </motion.p>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full"
      style={{ background: `${BRAND.gold}15`, border: `1px solid ${BRAND.gold}30` }}
    >
      <Sparkles className="size-3.5" style={{ color: BRAND.gold }} />
      <span className="text-xs font-medium" style={{ color: BRAND.gold }}>
        Connecting Abians Worldwide
      </span>
    </motion.div>
  </>
);

const AboutView = ({ slide }: { slide: AboutSlide }) => (
  <div className="w-full max-w-sm">
    <div
      className="mb-6 inline-flex p-3.5 rounded-2xl"
      style={{ background: `${BRAND.green}40`, color: BRAND.gold }}
    >
      <ShieldCheck className="size-8" />
    </div>
    <h2 className="text-3xl font-bold mb-2" style={{ color: BRAND.text }}>
      {slide.title}
    </h2>
    <p className="text-sm mb-6" style={{ color: BRAND.textDim }}>
      The digital home of indigenous Abians
    </p>
    <div className="space-y-3 text-left">
      {slide.cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
          className="flex gap-3 p-4 rounded-2xl backdrop-blur-sm"
          style={{
            background: `${BRAND.surface}66`,
            border: `1px solid ${BRAND.border}`,
          }}
        >
          <div
            className="shrink-0 size-10 rounded-xl flex items-center justify-center"
            style={{ background: `${BRAND.gold}1A`, color: BRAND.gold }}
          >
            <c.icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm mb-1" style={{ color: BRAND.text }}>
              {c.label}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: BRAND.textMuted }}>
              {c.body}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const FeaturesView = ({ slide }: { slide: FeaturesSlide }) => (
  <div className="w-full max-w-md">
    <h2 className="text-3xl font-bold mb-2" style={{ color: BRAND.text }}>
      {slide.title}
    </h2>
    <p className="text-sm mb-6" style={{ color: BRAND.textDim }}>
      Built for community, identity & progress
    </p>
    <div className="grid grid-cols-2 gap-3">
      {slide.features.map((f, i) => (
        <motion.div
          key={f.name}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.08, duration: 0.35, ease: 'easeOut' }}
          className="p-4 rounded-2xl flex flex-col items-center text-center backdrop-blur-sm"
          style={{
            background: `${BRAND.surface}80`,
            border: `1px solid ${BRAND.border}`,
          }}
        >
          <div
            className="p-2.5 rounded-xl mb-2.5"
            style={{ background: `${BRAND.gold}1A`, color: BRAND.gold }}
          >
            <f.icon className="size-5" />
          </div>
          <h3 className="font-bold text-xs mb-0.5" style={{ color: BRAND.text }}>
            {f.name}
          </h3>
          <p className="text-[10px] leading-tight" style={{ color: BRAND.textDim }}>
            {f.desc}
          </p>
        </motion.div>
      ))}
    </div>
  </div>
);

const StartView = ({
  slide,
  onCreate,
  onSignIn,
}: {
  slide: StartSlide;
  onCreate: () => void;
  onSignIn: () => void;
}) => (
  <div className="w-full max-w-xs">
    <motion.div
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
      className="size-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
        boxShadow: `0 12px 32px -8px ${BRAND.gold}66`,
      }}
    >
      <Rocket className="size-12" style={{ color: BRAND.bg }} />
    </motion.div>
    <h2 className="text-3xl font-bold mb-3" style={{ color: BRAND.text }}>
      {slide.title}
    </h2>
    <p className="text-base mb-8" style={{ color: BRAND.textMuted }}>
      {slide.subtitle}
    </p>
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        onClick={onCreate}
        className="h-14 rounded-2xl text-base font-bold"
        style={{
          background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
          color: BRAND.bg,
          boxShadow: `0 10px 28px -10px ${BRAND.gold}80`,
        }}
      >
        Create Account
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={onSignIn}
        className="h-14 rounded-2xl text-base font-bold bg-transparent hover:bg-white/5"
        style={{
          borderColor: BRAND.gold,
          color: BRAND.gold,
        }}
      >
        Sign In
      </Button>
    </div>
    <p className="mt-6 text-xs" style={{ color: BRAND.textDim }}>
      By continuing you agree to our Terms & Privacy Policy
    </p>
  </div>
);
