import { keepDatabaseReadsFresh } from '@/lib/freshDatabaseReads'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Toaster } from '@/components/ui/sonner'
import { AdConsentBanner } from '@/components/AdConsentBanner'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { GoogleSignInLanding } from '@/components/auth/GoogleSignInButton'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Capacitor } from '@capacitor/core'
import '@fontsource/lora/400.css'
import '@fontsource/lora/500.css'
import '@fontsource/lora/600.css'
import '@fontsource/lora/700.css'
import '@fontsource/lora/400-italic.css'
import '@fontsource/nunito-sans/400.css'
import '@fontsource/nunito-sans/600.css'
import '@fontsource/nunito-sans/700.css'
import './index.css'

keepDatabaseReadsFresh()

// App-only styling hook (Tailwind `native:` variant). index.html sets it early;
// this is the fallback if Capacitor wasn't ready then.
if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native-app')

// Diagnostics for native bridge
if (typeof window !== 'undefined') {
  console.log('[NativeBridge] Initializing web bundle...');
  console.log('[NativeBridge] Platform:', Capacitor.getPlatform());
  console.log('[NativeBridge] isNative:', Capacitor.isNativePlatform());

  // Expose to window for debugging via Chrome DevTools / Remote Debugging
  (window as any).Capacitor = Capacitor;
}

// Diagnostics for native bridge
if (typeof window !== 'undefined') {
  console.log('[NativeBridge] Initializing web bundle...');
  console.log('[NativeBridge] Platform:', Capacitor.getPlatform());
  console.log('[NativeBridge] isNative:', Capacitor.isNativePlatform());
  (window as any).Capacitor = Capacitor;
}

// Implement a robust cache-clearing routine that runs on every load to prevent
// any previously cached offline/PWA assets from persisting.
if (typeof window !== 'undefined') {
  // 1. Unregister Service Workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }

  // 2. Clear Cache Storage
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

const queryClient = new QueryClient()

function PushBootstrap() {
  usePushNotifications()
  return null
}

const rootEl = document.getElementById('root')!
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <PushBootstrap />
              <GoogleSignInLanding />
              <AppErrorBoundary>
                <App />
              </AppErrorBoundary>
              <Toaster richColors position="top-right" />
              <AdConsentBanner />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
