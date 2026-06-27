import { useState, useEffect } from 'react';
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { checkSupabaseConnection } from '@/lib/supabase';

export function ConnectivityStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseReachable, setIsSupabaseReachable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async (isInitial = false) => {
    setIsChecking(true);
    const result = await checkSupabaseConnection();
    const wasPreviouslyDisconnected = isSupabaseReachable === false;

    setIsSupabaseReachable(result.connected);
    setIsChecking(false);

    if (!result.connected) {
      console.error('Connection check failed:', result.error);
      // Only show error toast if not the initial check (to avoid noise on every app start)
      if (!isInitial) {
        toast.error('Network Error: Cannot reach the server. Please check your internet connection.');
      }
    } else if (wasPreviouslyDisconnected && !isInitial) {
      toast.success('Connection restored!');
    }
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

    // Initial check - passing true to suppress the 'restored' toast
    if (navigator.onLine) {
      checkConnection(true);
    }

    return () => {
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
          onClick={checkConnection}
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
