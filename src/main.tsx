import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Toaster } from '@/components/ui/sonner'
import { registerSW } from './lib/registerSW'
import './index.css'

// Defer non-critical work until after first paint.
if (typeof window !== 'undefined') {
  const onIdle = (cb: () => void) =>
    'requestIdleCallback' in window
      ? (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb)
      : window.setTimeout(cb, 1)
  window.addEventListener('load', () => onIdle(() => registerSW()), { once: true })
}

// Remove the inline splash once React has rendered the real UI.
const removeSplash = () => {
  const el = document.getElementById('ac-splash')
  if (!el) return
  el.classList.add('ac-hide')
  setTimeout(() => el.remove(), 260)
}

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <App />
              <Toaster richColors position="top-right" />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
)
