import { lazy, Suspense, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const MobileOnboarding = lazy(() =>
  import('./MobileOnboarding').then((m) => ({ default: m.MobileOnboarding }))
);

const STORAGE_KEY = 'hasSeenOnboarding';

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
    if (!Capacitor.isNativePlatform() || loading) return;

    // Never cover real app screens. The native welcome gate is only allowed on
    // the root route; otherwise login, chats, threads, and push deep-links stay
    // immediately interactive instead of sitting behind a full-screen overlay.
    if (location.pathname !== '/') {
      setShow(false);
      return;
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY) === 'true';

    // If not logged in, we always show the gate on native.
    if (!user) {
      setShow(true);
      // If they've seen the intro before, jump straight to the "Ready to join" slide.
      setStartAtLast(hasSeen);
    } else {
      // If logged in, only show if they haven't finished onboarding yet.
      setShow(!hasSeen);
      setStartAtLast(false);
    }
  }, [user, loading, location.pathname]);

  if (!show || loading) return null;

  return (
    <Suspense fallback={null}>
      <MobileOnboarding
        onFinish={() => setShow(false)}
        initialSlide={startAtLast ? 3 : 0}
      />
    </Suspense>
  );
};
