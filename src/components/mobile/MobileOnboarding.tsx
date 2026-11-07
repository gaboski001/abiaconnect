import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  Gift,
  Heart,
  MessagesSquare,
  Phone,
  Rocket,
  Sparkles,
  UserRound,
  Users,
  Vote,
  X,
} from 'lucide-react';

interface MobileOnboardingProps {
  onFinish: () => void;
  initialSlide?: number;
  /** Called once the intro has painted (lets the native launch overlay go). */
  onReady?: () => void;
}

const GOLD = '#F8C301';
const GOLD_DARK = '#E87015';
const INK = '#0B1F0B';

/** Each slide has its own colour, faded in behind the swipe. */
const SLIDE_BACKGROUNDS = [
  'linear-gradient(160deg, #0B3D1E 0%, #14532D 55%, #0B1F0B 100%)',
  'linear-gradient(160deg, #065F46 0%, #0F766E 55%, #0B3D2E 100%)',
  'linear-gradient(160deg, #BE185D 0%, #DB2777 50%, #6D1B45 100%)',
  'linear-gradient(160deg, #B45309 0%, #C2410C 45%, #0B1F0B 100%)',
];

const LAST_SLIDE = SLIDE_BACKGROUNDS.length - 1;

/** Soft drifting dots in the background — pure CSS/Motion, no canvas. */
const Particles = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        size: 3 + Math.random() * 4,
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
          className="absolute rounded-full bg-white"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -40, 0], opacity: [0.08, 0.35, 0.08] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
};

export const MobileOnboarding = ({ onFinish, initialSlide = 0, onReady }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    duration: 24,
    startIndex: initialSlide,
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

  const handleFinish = () => {
    // If skipping from an early slide and not logged in, go to the last slide instead of finishing.
    if (!user && currentSlide < LAST_SLIDE) {
      emblaApi?.scrollTo(LAST_SLIDE);
      return;
    }

    try {
      localStorage.setItem('hasSeenOnboarding', 'true');
    } catch {
      /* ignore */
    }
    onFinish();
  };

  const handleNext = () => {
    if (emblaApi?.canScrollNext()) emblaApi.scrollNext();
    else handleFinish();
  };

  const isLast = currentSlide === LAST_SLIDE;

  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The intro is an overlay on top of the app. Lock the page underneath so
  // vertical swipes don't scroll it (that showed a moving edge/stretch line).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  const views = [
    <WelcomeView key="welcome" />,
    <CommunityView key="community" />,
    <SwipeView key="swipe" active={currentSlide === 2} />,
    <StartView
      key="start"
      onCreate={() => {
        handleFinish();
        navigate('/register');
      }}
      onSignIn={() => {
        handleFinish();
        navigate('/login');
      }}
    />,
  ];

  return (
    <motion.div
      // Opaque from the first frame: fading in from transparent would let the
      // page underneath show through.
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden overscroll-none font-sans text-white"
      style={{ background: INK }}
      role="dialog"
      aria-label="Welcome to AbiaConnect"
    >
      {SLIDE_BACKGROUNDS.map((background, i) => (
        <motion.div
          key={background}
          className="absolute inset-0 pointer-events-none"
          style={{ background }}
          initial={false}
          animate={{ opacity: currentSlide === i ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      ))}
      <Particles />

      {/* Top bar: Skip */}
      <div
        className="relative z-10 flex h-14 items-center justify-end px-4"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        {!isLast && (
          <Button
            variant="ghost"
            onClick={handleFinish}
            className="rounded-full font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Skip onboarding"
          >
            Skip
          </Button>
        )}
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-hidden relative z-10" ref={emblaRef} style={{ touchAction: 'pan-y pinch-zoom' }}>
        <div className="flex h-full">
          {views.map((view, idx) => (
            <div
              key={idx}
              className="flex-[0_0_100%] h-full overflow-y-auto overscroll-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <motion.div
                initial={false}
                animate={{ opacity: currentSlide === idx ? 1 : 0.3, y: currentSlide === idx ? 0 : 14 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="min-h-full flex flex-col items-center justify-center px-7 py-4 text-center"
              >
                {view}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress dots + Next. The last slide has its own buttons, but keeps
          its dots so people can see where they are and go back. */}
      <div
        className="relative z-10 flex min-h-[4.5rem] items-center justify-between gap-4 px-7 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
      >
        <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding progress">
          {SLIDE_BACKGROUNDS.map((_, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              role="tab"
              aria-selected={currentSlide === i}
              aria-label={`Go to slide ${i + 1}`}
              className="h-2 rounded-full"
              initial={false}
              animate={{
                width: currentSlide === i ? 26 : 8,
                backgroundColor: currentSlide === i ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
              }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            />
          ))}
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={handleNext}
            aria-label={currentSlide === LAST_SLIDE - 1 ? 'Get started' : 'Next slide'}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold shadow-xl transition-transform active:scale-95"
            style={{ color: INK }}
          >
            {currentSlide === LAST_SLIDE - 1 ? 'Get started' : 'Next'}
            <ArrowRight className="size-[18px]" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

/* ---------- Slide views ---------- */

const Headline = ({ title, body }: { title: ReactNode; body: string }) => (
  <>
    <h2 className="text-[34px] font-black leading-[1.1] tracking-tight">{title}</h2>
    <p className="mt-3 max-w-xs text-[16px] font-medium leading-relaxed text-white/85">{body}</p>
  </>
);

const WelcomeView = () => (
  <>
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, y: [0, -6, 0] }}
      transition={{
        scale: { duration: 0.6, ease: 'easeOut' },
        opacity: { duration: 0.5 },
        y: { delay: 0.8, duration: 4, repeat: Infinity, ease: 'easeInOut' },
      }}
      className="relative mb-7 flex size-44 items-center justify-center rounded-full bg-white/10"
    >
      <img
        src="/email-logo.png"
        alt="AbiaConnect logo"
        className="h-32 w-36 object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.35)]"
      />
    </motion.div>
    <Headline
      title={
        <>
          Welcome home,
          <br />
          <span style={{ color: GOLD }}>Abian</span> 👋🏾
        </>
      }
      body="Your people, your LGA and your news, all in one place, wherever you live."
    />
    <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-bold">
      <Sparkles className="size-4" style={{ color: GOLD }} />
      Connecting Abians worldwide
    </span>
  </>
);

const COMMUNITY_ITEMS = [
  { icon: MessagesSquare, name: 'Join the talk', desc: 'Discussions on what matters to Abians', color: '#38BDF8' },
  { icon: Users, name: 'Your LGA group', desc: 'Meet people from your own home town', color: '#34D399' },
  { icon: Vote, name: 'Polls and contests', desc: 'Have your say and vote', color: GOLD },
  { icon: Gift, name: 'Daily rewards', desc: 'Earn points for taking part', color: '#FB7185' },
];

const CommunityView = () => (
  <>
    <Headline title="Be part of the conversation" body="Something new to read, answer and vote on every day." />
    <ul className="mt-6 w-full max-w-sm space-y-2.5 text-left">
      {COMMUNITY_ITEMS.map((item) => (
        <li key={item.name} className="flex items-center gap-3.5 rounded-2xl bg-white/[0.13] p-3.5">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${item.color}33`, color: item.color }}
          >
            <item.icon className="size-[22px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-tight">{item.name}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/75">{item.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  </>
);

/** A small animated card showing the Connect swipe. */
const SwipeView = ({ active }: { active: boolean }) => {
  const reduceMotion = useReducedMotion();
  const animate = active && !reduceMotion;
  const timing = { duration: 4, repeat: Infinity, ease: 'easeInOut' as const, times: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  return (
    <>
      <div className="relative mb-7 h-56 w-44">
        <div className="absolute inset-0 translate-y-2 scale-95 rotate-[-5deg] rounded-3xl bg-white/20" aria-hidden />
        <motion.div
          className="absolute inset-0 overflow-hidden rounded-3xl bg-white shadow-2xl"
          animate={animate ? { x: [0, 56, 0, -56, 0, 0], rotate: [0, 10, 0, -10, 0, 0] } : { x: 0, rotate: 0 }}
          transition={timing}
          aria-hidden
        >
          <div className="flex h-[70%] items-center justify-center bg-gradient-to-br from-pink-200 to-amber-100">
            <UserRound className="size-20 text-pink-500/70" />
          </div>
          <div className="space-y-2 p-3.5">
            <div className="h-2.5 w-3/4 rounded-full bg-slate-300" />
            <div className="h-2 w-1/2 rounded-full bg-slate-200" />
          </div>
          <motion.span
            className="absolute left-2.5 top-3 -rotate-12 rounded-lg border-[3px] border-emerald-500 px-1.5 text-[13px] font-black text-emerald-500"
            animate={animate ? { opacity: [0, 1, 0, 0, 0, 0] } : { opacity: 0 }}
            transition={timing}
          >
            CONNECT
          </motion.span>
          <motion.span
            className="absolute right-2.5 top-3 rotate-12 rounded-lg border-[3px] border-rose-500 px-1.5 text-[13px] font-black text-rose-500"
            animate={animate ? { opacity: [0, 0, 0, 1, 0, 0] } : { opacity: 0 }}
            transition={timing}
          >
            SKIP
          </motion.span>
        </motion.div>
      </div>
      <Headline title="Swipe to meet people" body="Swipe right to connect, left to skip. Find friends, business partners and more." />
      <div className="mt-5 flex items-center justify-center gap-2 text-[13px] font-bold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
          <X className="size-4" /> Skip
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
          <Heart className="size-4" fill="currentColor" /> Connect
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
          <Phone className="size-4" /> Chat
        </span>
      </div>
    </>
  );
};

const StartView = ({ onCreate, onSignIn }: { onCreate: () => void; onSignIn: () => void }) => (
  <div className="w-full max-w-sm">
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className="mx-auto mb-7 flex size-24 items-center justify-center rounded-[2rem] shadow-2xl"
      style={{ background: `linear-gradient(145deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
    >
      <Rocket className="size-12" style={{ color: INK }} />
    </motion.div>
    <div className="flex flex-col items-center">
      <Headline title="Ready when you are" body="Join in a minute and meet your community." />
    </div>
    <div className="mt-8 flex flex-col gap-3">
      <Button
        size="lg"
        onClick={onCreate}
        className="h-14 rounded-2xl border-0 text-[17px] font-bold transition-transform active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`, color: INK }}
      >
        Create a free account
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={onSignIn}
        className="h-14 rounded-2xl border-white/30 bg-white/10 text-[17px] font-bold text-white transition-transform hover:bg-white/20 hover:text-white active:scale-[0.98]"
      >
        Sign in
      </Button>
    </div>
    <p className="mt-6 text-[12px] font-semibold text-white/60">One People. One Voice.</p>
  </div>
);
