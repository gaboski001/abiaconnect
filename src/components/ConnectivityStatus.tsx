import { useState, useEffect } from 'react';
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '@/lib/toast';
import { checkSupabaseConnection } from '@/lib/supabase';

export function ConnectivityStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseReachable, setIsSupabaseReachable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const failuresRef = (typeof window !== 'undefined') ? (window as any).__abiaConnFailRef ||= { count: 0 } : { count: 0 };

  const checkConnection = async (isInitial = false) => {
    setIsChecking(true);
    const result = await checkSupabaseConnection();
    const wasPreviouslyDisconnected = isSupabaseReachable === false;

    if (result.connected) {
      failuresRef.count = 0;
      setIsSupabaseReachable(true);
      if (wasPreviouslyDisconnected && !isInitial) {
        toast.success('Connection restored!');
      }
    } else {
      failuresRef.count += 1;
      // Require 2 consecutive failures before flagging as unreachable — avoids
      // false positives during iOS WKWebView cold-start when the network stack
      // isn't ready yet.
      if (failuresRef.count >= 2) {
        setIsSupabaseReachable(false);
        if (!isInitial) {
          toast.error('Network Error: Cannot reach the server. Please check your internet connection.');
        }
      } else {
        // schedule a quick retry
        setTimeout(() => { void checkConnection(true); }, 1500);
      }
    }
    setIsChecking(false);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkConnection();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsSupabaseReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Defer initial probe so WKWebView/Capacitor bridge has time to settle.
    const initialTimer = window.setTimeout(() => {
      if (navigator.onLine) void checkConnection(true);
    }, 2500);

    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && (isSupabaseReachable === true || isSupabaseReachable === null)) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {isOnline ? <AlertCircle className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
          <div className="flex-1">
            <p className="font-semibold text-sm">
              {!isOnline ? 'You are offline' : 'Server Unreachable'}
            </p>
            <p className="text-xs opacity-90">
              {!isOnline
                ? 'Please check your internet connection to continue using AbiaConnect.'
                : 'Unable to connect to the database. This might be due to a strict firewall or network issues.'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-8 text-xs font-medium"
          onClick={() => { void checkConnection() }}
          disabled={isChecking}
        >
          {isChecking ? (
            <RefreshCw className="h-3 w-3 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-2" />
          )}
          Retry Connection
        </Button>
      </div>
    </div>
  );
}
