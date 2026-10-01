import { lazy, Suspense, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const MobileOnboarding = lazy(() =>
  import('./MobileOnboarding').then((m) => ({ default: m.MobileOnboarding }))
);

const STORAGE_KEY = 'hasSeenOnboarding';
/**
 * Ends the native launch state (the `cap-launch` flag set in index.html). The
 * Android app keeps a splash overlay (navy + logo) on screen while the flag is
 * set and fades it out once cleared, so it must only be cleared when the first
 * real screen has painted.
 */
const endLaunch = () => document.documentElement.classList.remove('cap-launch');

/**
 * Native-only onboarding and authentication gate.
 *
 * 1. First-time users see the full 4-slide onboarding.
 * 2. Unauthenticated users (logged out or guests) on native platforms
 *    are shown the "Starter Page" (Slide 4) as the landing screen.
 *
 * On a cold start the Android splash overlay fades out to reveal the intro,
 * giving one smooth transition from the splash to the app.
 */
export const NativeOnboardingGate = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [startAtLast, setStartAtLast] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!Capacitor.isNativePlatform() || loading) return;

      // Never cover real app screens.
      if (location.pathname !== '/') {
        setShow(false);
        setChecked(true);
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
      setChecked(true);
    };

    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [user, loading, location.pathname]);

  // No intro to show (e.g. signed-in member): reveal the app straight away.
  useEffect(() => {
    if (!loading && checked && !show) endLaunch();
  }, [loading, checked, show]);

  // Never leave the page hidden, whatever happens.
  useEffect(() => {
    const t = setTimeout(endLaunch, 6000);
    return () => clearTimeout(t);
  }, []);

  if (!show || loading) return null;

  return (
    <Suspense fallback={null}>
      <MobileOnboarding
        onFinish={() => setShow(false)}
        onReady={endLaunch}
        initialSlide={startAtLast ? 3 : 0}
      />
    </Suspense>
  );
};
