import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/contexts/AuthContext';
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
  initialSlide?: number;
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

export const MobileOnboarding = ({ onFinish, initialSlide = 0 }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    duration: 24,
    startIndex: initialSlide
  });
  const [currentSlide, setCurrentSlide] = useState(initialSlide);

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
    // If skipping from an early slide and not logged in, go to the last slide instead of finishing.
    if (!user && currentSlide < slides.length - 1) {
      emblaApi?.scrollTo(slides.length - 1);
      return;
    }

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
        <AnimatePresence>
          {!isLast && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
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
            </motion.div>
          )}
        </AnimatePresence>
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

          {/* Tiny Line Indicators */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Onboarding progress">
            {slides.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                role="tab"
                aria-selected={currentSlide === i}
                aria-label={`Go to slide ${i + 1}`}
                className="h-1 rounded-full flex-shrink-0"
                initial={false}
                animate={{
                  width: currentSlide === i ? 16 : 4,
                  backgroundColor: currentSlide === i ? BRAND.gold : `${BRAND.gold}20`,
                }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
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
          className="w-36 h-32 object-contain drop-shadow-[0_20px_50px_rgba(200,169,81,0.3)]"
        />
      </motion.div>
    </motion.div>
    <motion.h1
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="text-5xl font-black mb-4 leading-[1.1] tracking-tight bg-clip-text text-transparent px-2"
      style={{ backgroundImage: `linear-gradient(135deg, ${BRAND.gold} 0%, #FDE68A 100%)` }}
    >
      {slide.tagline}
    </motion.h1>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="text-xl font-bold max-w-xs mx-auto leading-snug"
      style={{ color: BRAND.text }}
    >
      {slide.subtitle}
    </motion.p>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="mt-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-full shadow-lg"
      style={{ background: `${BRAND.gold}20`, border: `1px solid ${BRAND.gold}40` }}
    >
      <Sparkles className="size-4" style={{ color: BRAND.gold }} />
      <span className="text-sm font-bold tracking-wide" style={{ color: BRAND.gold }}>
        Connecting Abians Worldwide
      </span>
    </motion.div>
  </>
);

const AboutView = ({ slide }: { slide: AboutSlide }) => (
  <div className="w-full max-w-sm">
    <div
      className="mb-8 inline-flex p-4 rounded-3xl shadow-xl"
      style={{ background: `${BRAND.green}60`, color: BRAND.gold, border: `1px solid ${BRAND.gold}30` }}
    >
      <ShieldCheck className="size-10" />
    </div>
    <h2 className="text-4xl font-black mb-3 tracking-tight" style={{ color: BRAND.text }}>
      {slide.title}
    </h2>
    <p className="text-lg font-bold mb-8" style={{ color: BRAND.gold }}>
      The digital home of indigenous Abians
    </p>
    <div className="space-y-4 text-left">
      {slide.cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
          className="flex gap-4 p-5 rounded-[1.5rem] backdrop-blur-md shadow-lg"
          style={{
            background: `${BRAND.surface}90`,
            border: `1px solid ${BRAND.border}`,
          }}
        >
          <div
            className="shrink-0 size-12 rounded-2xl flex items-center justify-center shadow-inner"
            style={{ background: `${BRAND.gold}20`, color: BRAND.gold }}
          >
            <c.icon className="size-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-base mb-1 uppercase tracking-wider" style={{ color: BRAND.gold }}>
              {c.label}
            </h3>
            <p className="text-sm leading-relaxed font-medium" style={{ color: BRAND.text }}>
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
    <h2 className="text-4xl font-black mb-3 tracking-tight" style={{ color: BRAND.text }}>
      {slide.title}
    </h2>
    <p className="text-lg font-bold mb-10" style={{ color: BRAND.gold }}>
      Built for community & progress
    </p>
    <div className="grid grid-cols-2 gap-4">
      {slide.features.map((f, i) => (
        <motion.div
          key={f.name}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.08, duration: 0.35, ease: 'easeOut' }}
          className="p-5 rounded-[1.5rem] flex flex-col items-center text-center backdrop-blur-md shadow-xl"
          style={{
            background: `${BRAND.surface}99`,
            border: `1px solid ${BRAND.border}`,
          }}
        >
          <div
            className="p-3 rounded-2xl mb-3.5 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${BRAND.gold}30 0%, ${BRAND.gold}10 100%)`, color: BRAND.gold }}
          >
            <f.icon className="size-6" />
          </div>
          <h3 className="font-black text-sm mb-1 tracking-tight" style={{ color: BRAND.text }}>
            {f.name}
          </h3>
          <p className="text-xs leading-tight font-bold" style={{ color: BRAND.textMuted }}>
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
  <div className="w-full max-w-sm px-4">
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
      className="relative size-32 mx-auto mb-10"
    >
      {/* Premium Glow Effect */}
      <div
        className="absolute inset-0 rounded-[2.5rem] blur-2xl opacity-40 animate-pulse"
        style={{ background: BRAND.gold }}
      />

      <div
        className="relative h-full w-full rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-2xl overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
        }}
      >
        {/* Subtle glass reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50" />
        <Rocket className="size-16 drop-shadow-lg" style={{ color: BRAND.bg }} />
      </div>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
    >
      <h2 className="text-4xl font-black mb-4 tracking-tight" style={{ color: BRAND.text }}>
        Your Community.<br />
        <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${BRAND.gold}, #FDE68A)` }}>
          Your Identity.
        </span>
      </h2>

      <p className="text-lg leading-relaxed mb-10 font-medium" style={{ color: BRAND.textMuted }}>
        Join the official digital home for <span className="text-white">indigenous Abians</span> worldwide.
        Stay connected, stay informed, and grow with us.
      </p>
    </motion.div>

    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      <Button
        size="lg"
        onClick={onCreate}
        className="h-16 rounded-2xl text-lg font-bold transition-all active:scale-[0.98]"
        style={{
          background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
          color: BRAND.bg,
          boxShadow: `0 12px 30px -10px ${BRAND.gold}90`,
        }}
      >
        Join the Community
      </Button>

      <Button
        size="lg"
        variant="outline"
        onClick={onSignIn}
        className="h-16 rounded-2xl text-lg font-bold bg-white/5 border-white/10 backdrop-blur-md transition-all active:scale-[0.98] hover:bg-white/10"
        style={{
          color: BRAND.text,
        }}
      >
        Sign in to your Account
      </Button>
    </motion.div>

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ delay: 1, duration: 1 }}
      className="mt-10 pt-6 border-t border-white/5"
    >
      <p className="text-[11px] uppercase tracking-widest font-bold opacity-60" style={{ color: BRAND.textDim }}>
        AbiaConnect &copy; 2026 • One People. One Voice.
      </p>
    </motion.div>
  </div>
);
