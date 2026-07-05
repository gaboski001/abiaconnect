import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import { isBiometricAvailable } from '@/lib/biometric';

export const NativeDiagnostics = () => {
  const [isNative, setIsNative] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bioAvailable, setBioAvailable] = useState('Checking...');
  const [platform, setPlatform] = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState('');
  const location = useLocation();

  useEffect(() => {
    const checkBridge = async () => {
      const native = Capacitor.isNativePlatform();
      const plat = Capacitor.getPlatform();

      setIsNative(native);
      setPlatform(plat);
      setOnboardingStatus(localStorage.getItem('hasSeenOnboarding') || 'false');

      if (plat !== 'web') {
        setBridgeReady(true);
        const bio = await isBiometricAvailable();
        setBioAvailable(bio ? 'YES' : 'NO');
      } else {
        setBioAvailable('N/A');
      }
    };

    checkBridge();
    const timer = setInterval(checkBridge, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed bottom-24 left-4 z-[9999] flex flex-col gap-1 rounded-lg border border-amber-500/50 bg-black/80 p-2 text-[10px] font-mono text-amber-500 backdrop-blur-md shadow-2xl pointer-events-auto">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${bridgeReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="font-bold">
          {bridgeReady ? 'NATIVE BRIDGE LIVE' : 'WEB BROWSER MODE'}
        </span>
      </div>
      <div>Platform: {platform}</div>
      <div>Route: {location.pathname}</div>
      <div>Biometrics: {bioAvailable}</div>
      {bridgeReady && (
        <>
          <div>Onboarding: {onboardingStatus}</div>
          <button
            className="mt-1 rounded bg-amber-600 px-1 py-0.5 text-white pointer-events-auto active:bg-amber-700"
            onClick={() => {
              localStorage.removeItem('hasSeenOnboarding');
              window.location.reload();
            }}
          >
            Reset Onboarding
          </button>
        </>
      )}
    </div>
  );
};
