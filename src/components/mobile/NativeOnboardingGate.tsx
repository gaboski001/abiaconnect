import { lazy, Suspense, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const MobileOnboarding = lazy(() =>
  import('./MobileOnboarding').then((m) => ({ default: m.MobileOnboarding }))
);

const STORAGE_KEY = 'hasSeenOnboarding';

/** Solid brand backdrop matching the onboarding, shown while it loads. */
const BrandCover = () => (
  <div className="fixed inset-0 z-[100]" style={{ background: '#0B1F0B' }} aria-hidden />
);

/**
 * Native-only onboarding and authentication gate.
 *
 * 1. First-time users see the full 4-slide onboarding.
 * 2. Unauthenticated users (logged out or guests) on native platforms
 *    are shown the "Starter Page" (Slide 4) as the landing screen.
 */
export const NativeOnboardingGate = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [startAtLast, setStartAtLast] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!Capacitor.isNativePlatform() || loading) return;

      // Never cover real app screens.
      if (location.pathname !== '/') {
        setShow(false);
        return;
      }

      const hasSeen = localStorage.getItem(STORAGE_KEY) === 'true';

      if (!user) {
        setShow(true);
        setStartAtLast(hasSeen);
      } else {
        setShow(!hasSeen);
        setStartAtLast(false);
      }
    };

    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [user, loading, location.pathname]);

  // While auth is still loading on the native home screen, cover the page with
  // the brand background so the forum never flashes behind the intro slides.
  if (loading) {
    return Capacitor.isNativePlatform() && location.pathname === '/' ? <BrandCover /> : null;
  }
  if (!show) return null;

  return (
    <Suspense fallback={<BrandCover />}>
      <MobileOnboarding
        onFinish={() => setShow(false)}
        initialSlide={startAtLast ? 3 : 0}
      />
    </Suspense>
  );
};
