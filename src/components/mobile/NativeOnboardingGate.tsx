import { lazy, Suspense, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const MobileOnboarding = lazy(() =>
  import('./MobileOnboarding').then((m) => ({ default: m.MobileOnboarding }))
);

const STORAGE_KEY = 'hasSeenOnboarding';

/**
 * Native-only first-launch onboarding gate.
 *
 * Renders the 4-slide onboarding flow ONCE, exclusively inside the
 * Capacitor Android/iOS WebView. Web visitors (abiaconnect.com etc.)
 * never see it — `Capacitor.isNativePlatform()` returns false in a
 * regular browser, so the gate is a no-op there.
 */
export const NativeOnboardingGate = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'true') {
        setShow(true);
      }
    } catch {
      /* localStorage blocked — skip */
    }
  }, []);

  if (!show) return null;

  return (
    <Suspense fallback={null}>
      <MobileOnboarding onFinish={() => setShow(false)} />
    </Suspense>
  );
};
