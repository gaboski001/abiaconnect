import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import useEmblaCarousel from 'embla-carousel-react';
import {
  MessagesSquare,
  Users,
  Bell,
  Globe,
  ChevronRight,
  ShieldCheck,
  Zap,
  Rocket
} from 'lucide-react';

interface MobileOnboardingProps {
  onFinish: () => void;
}

export const MobileOnboarding = ({ onFinish }: MobileOnboardingProps) => {
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [currentSlide, setCurrentSlide] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);

  const slides = [
    {
      id: 1,
      title: "Welcome",
      tagline: settings.site_tagline || "Connect, Communicate, Collaborate",
      subtitle: "Your all-in-one community platform for Abians worldwide.",
      type: "welcome"
    },
    {
      id: 2,
      title: "About ABIACONNECT",
      content: "AbiaConnect is the digital home of indigenous Abians — bridging home and diaspora so culture, knowledge, commerce, and community thrive together.",
      mission: "Geography should never separate a people from their identity, community, or voice.",
      type: "about"
    },
    {
      id: 3,
      title: "Powerful Features",
      features: [
        { icon: MessagesSquare, name: "Community Forums", desc: "Structured discussions across 14 categories" },
        { icon: Users, name: "Subgroups", desc: "Connect by LGA, profession, or interest" },
        { icon: Zap, name: "Live Polls", desc: "Real-time pulse on community issues" },
        { icon: Bell, name: "Smart Alerts", desc: "Never miss an important update" }
      ],
      type: "features"
    },
    {
      id: 4,
      title: "Ready to Join?",
      subtitle: "Join 10,000+ Abians connecting from every corner of the globe.",
      type: "start"
    }
  ];

  const handleNext = () => {
    if (emblaApi?.canScrollNext()) {
      emblaApi.scrollNext();
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    onFinish();
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden font-sans"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 pointer-events-none" />

      <div className="absolute top-safe-offset-4 right-4 z-10 p-4">
        <Button variant="ghost" onClick={handleFinish} className="text-muted-foreground font-medium">
          Skip
        </Button>
      </div>

      <div className="flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide) => (
            <div key={slide.id} className="flex-[0_0_100%] h-full flex flex-col items-center justify-center p-8 text-center relative">
              {slide.type === "welcome" && (
                <>
                  <motion.div
                    animate={{ rotateY: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="mb-10 relative"
                  >
                    <div className="absolute inset-0 bg-[#C8A951]/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <div className="relative w-48 h-48 flex items-center justify-center bg-transparent rounded-3xl overflow-hidden">
                       <img src="/email-logo.png" alt="Logo" className="w-32 h-32 object-contain" />
                    </div>
                  </motion.div>
                  <h1 className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#C8A951] to-[#8A7A3A] leading-tight">
                    {slide.tagline}
                  </h1>
                  <p className="text-lg text-[#B0B0B0] max-w-xs mx-auto">
                    {slide.subtitle}
                  </p>
                </>
              )}

              {slide.type === "about" && (
                <div className="max-w-sm">
                  <div className="mb-8 inline-flex p-4 rounded-2xl bg-[#C8A951]/10 text-[#C8A951]">
                    <ShieldCheck className="size-12" />
                  </div>
                  <h2 className="text-3xl font-bold mb-6 text-white">{slide.title}</h2>
                  <div className="bg-[#1E1E1E]/50 backdrop-blur-sm p-6 rounded-3xl border border-[#2A2A2A] shadow-xl text-left space-y-4">
                    <p className="text-lg leading-relaxed text-white font-medium">{slide.content}</p>
                    <p className="text-sm text-[#707070] italic border-l-2 border-[#C8A951]/30 pl-4">{slide.mission}</p>
                  </div>
                </div>
              )}

              {slide.type === "features" && (
                <div className="w-full max-w-md px-4">
                  <h2 className="text-3xl font-bold mb-8 text-white">{slide.title}</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {slide.features?.map((f, i) => (
                      <div
                        key={f.name}
                        className="bg-[#1E1E1E]/40 backdrop-blur-sm p-5 rounded-3xl border border-[#2A2A2A] flex flex-col items-center text-center shadow-sm"
                      >
                        <div className="p-3 rounded-2xl bg-[#C8A951]/10 text-[#C8A951] mb-3">
                          <f.icon className="size-6" />
                        </div>
                        <h3 className="font-bold text-sm mb-1 text-white">{f.name}</h3>
                        <p className="text-[10px] leading-tight text-[#707070] uppercase tracking-wider">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {slide.type === "start" && (
                <div className="w-full max-w-xs px-4">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#C8A951] to-[#8A7A3A] rounded-3xl shadow-lg shadow-[#C8A951]/20 flex items-center justify-center mx-auto mb-8">
                    <Rocket className="size-12 text-[#0D0D0D]" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4 text-white">{slide.title}</h2>
                  <p className="text-lg text-[#B0B0B0] mb-10">{slide.subtitle}</p>
                  <div className="flex flex-col gap-4">
                    <Button size="lg" className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-[#C8A951]/20 bg-[#C8A951] text-[#0D0D0D] hover:bg-[#C8A951]/90" onClick={() => { handleFinish(); navigate('/register'); }}>
                      Create Account
                    </Button>
                    <Button size="lg" variant="outline" className="h-14 rounded-2xl text-lg font-bold bg-[#0D0D0D]/50 backdrop-blur-sm border-[#C8A951] text-[#C8A951] hover:bg-[#C8A951]/10" onClick={() => { handleFinish(); navigate('/login'); }}>
                      Sign In
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-10 flex items-center justify-end bg-background/50 backdrop-blur-md border-t border-white/5">
        <Button
          size="icon"
          onClick={handleNext}
          className="size-14 rounded-2xl shadow-xl shadow-secondary/20 group bg-secondary text-background hover:bg-secondary/90"
        >
          {currentSlide === slides.length - 1 ? (
             <ShieldCheck className="size-6" />
          ) : (
            <ChevronRight className="size-6 group-hover:translate-x-0.5 transition-transform" />
          )}
        </Button>
      </div>
    </motion.div>
  );
};