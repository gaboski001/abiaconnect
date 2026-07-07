import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Toaster } from '@/components/ui/sonner'
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

// Best-effort: unregister any previously installed PWA service workers so
// returning browsers don't keep serving a stale app shell after we removed PWA.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((rs) => rs.forEach((r) => r.unregister()))
    .catch(() => {})
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
              <App />
              <Toaster richColors position="top-right" />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
