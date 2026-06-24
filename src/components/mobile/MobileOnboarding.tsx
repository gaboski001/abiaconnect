import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useSignedUrl } from '@/hooks/useSignedUrl';
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets');

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
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    onFinish();
  };

  const current = slides[currentSlide];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden font-sans"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 pointer-events-none" />

      {/* Animated Particles (CSS only for performance) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="absolute top-safe-offset-4 right-4 z-10 p-4">
        <Button variant="ghost" onClick={handleFinish} className="text-muted-foreground font-medium">
          Skip
        </Button>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "circOut" }}
            className="h-full w-full flex flex-col items-center justify-center p-8 text-center"
          >
            {current.type === "welcome" && (
              <>
                <motion.div
                  animate={{
                    rotateY: 360,
                    scale: [0.95, 1.05, 0.95]
                  }}
                  transition={{
                    rotateY: { duration: 15, repeat: Infinity, ease: "linear" },
                    scale: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="mb-10 relative"
                >
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                  <div className="relative w-48 h-48 flex items-center justify-center bg-transparent backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl as string} alt="Logo" className="w-32 h-32 object-contain" />
                    ) : (
                      <div className="w-32 h-32 bg-primary/20 rounded-2xl flex items-center justify-center">
                        <Globe className="size-16 text-primary animate-spin-slow" />
                      </div>
                    )}
                  </div>
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary leading-tight"
                >
                  {current.tagline}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-muted-foreground max-w-xs mx-auto"
                >
                  {current.subtitle}
                </motion.p>
              </>
            )}

            {current.type === "about" && (
              <div className="max-w-sm">
                <div className="mb-8 inline-flex p-4 rounded-2xl bg-secondary/10 text-secondary">
                  <ShieldCheck className="size-12" />
                </div>
                <h2 className="text-3xl font-bold mb-6">{current.title}</h2>
                <div className="bg-card/50 backdrop-blur-sm p-6 rounded-3xl border shadow-xl text-left space-y-4">
                  <p className="text-lg leading-relaxed text-foreground font-medium">{current.content}</p>
                  <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-4">{current.mission}</p>
                </div>
              </div>
            )}

            {current.type === "features" && (
              <div className="w-full max-w-md">
                <h2 className="text-3xl font-bold mb-8">{current.title}</h2>
                <div className="grid grid-cols-2 gap-4">
                  {current.features?.map((f, i) => (
                    <motion.div
                      key={f.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-card/40 backdrop-blur-sm p-5 rounded-3xl border border-white/5 flex flex-col items-center text-center hover:bg-card/60 transition-colors shadow-sm"
                    >
                      <div className="p-3 rounded-2xl bg-primary/10 text-primary mb-3">
                        <f.icon className="size-6" />
                      </div>
                      <h3 className="font-bold text-sm mb-1">{f.name}</h3>
                      <p className="text-[10px] leading-tight text-muted-foreground uppercase tracking-wider">{f.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {current.type === "start" && (
              <div className="w-full max-w-xs">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-24 h-24 bg-gradient-to-br from-primary to-secondary rounded-3xl shadow-lg shadow-primary/20 flex items-center justify-center mx-auto mb-8"
                >
                  <Rocket className="size-12 text-white" />
                </motion.div>
                <h2 className="text-4xl font-bold mb-4">{current.title}</h2>
                <p className="text-lg text-muted-foreground mb-10">{current.subtitle}</p>
                <div className="flex flex-col gap-4">
                  <Button size="lg" className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20" onClick={() => { handleFinish(); navigate('/register'); }}>
                    Create Account
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 rounded-2xl text-lg font-bold bg-background/50 backdrop-blur-sm" onClick={() => { handleFinish(); navigate('/login'); }}>
                    Sign In
                  </Button>
                  <Button variant="ghost" className="mt-2 text-muted-foreground" onClick={handleFinish}>
                    Continue as Guest
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <div className="p-10 flex items-center justify-between bg-background/50 backdrop-blur-md border-t border-white/5">
        <div className="flex gap-2.5">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === currentSlide ? "w-8 bg-primary" : "w-1.5 bg-primary/20"
              }`}
            />
          ))}
        </div>
        <Button
          size="icon"
          onClick={handleNext}
          className="size-14 rounded-2xl shadow-xl shadow-primary/20 group"
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