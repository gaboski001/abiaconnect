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
type IdleWindow = Window & { requestIdleCallback?: (cb: () => void) => void }
const onIdle = (cb: () => void) => {
  const w = window as IdleWindow
  if (w.requestIdleCallback) w.requestIdleCallback(cb)
  else window.setTimeout(cb, 1)
}
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => onIdle(() => registerSW()), { once: true })
}

// Remove the inline splash once React has rendered the real UI.
const removeSplash = () => {
  const el = document.getElementById('ac-splash')
  if (!el) return
  el.classList.add('ac-hide')
  window.setTimeout(() => el.remove(), 260)
}

const queryClient = new QueryClient()

const rootEl = document.getElementById('root')!
ReactDOM.createRoot(rootEl).render(
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
  </React.StrictMode>,
)

requestAnimationFrame(removeSplash)

