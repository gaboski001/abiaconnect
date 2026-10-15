import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  setAdConsent,
  shouldAskAdConsent,
  startPixelIfAllowed,
  trackPageView,
} from '@/lib/metaPixel'

/**
 * Asks once whether AbiaConnect may measure its Facebook ads, and records a
 * page view on every page change for visitors who agreed.
 */
export function AdConsentBanner() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    startPixelIfAllowed()
    setOpen(shouldAskAdConsent())
  }, [])

  // A single-page site: each screen change is a new page view.
  useEffect(() => {
    trackPageView()
  }, [location.pathname])

  if (!open) return null

  const choose = (choice: 'granted' | 'denied') => {
    setAdConsent(choice)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookies for measuring our ads"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur sm:p-5"
    >
      <p className="text-sm leading-relaxed text-foreground">
        We use a Meta (Facebook) pixel to see whether our ads bring people to AbiaConnect. It is
        off unless you agree.{' '}
        <Link to="/cookie-policy" className="underline">
          Cookie Policy
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => choose('denied')}>
          No thanks
        </Button>
        <Button size="sm" onClick={() => choose('granted')}>
          Accept
        </Button>
      </div>
    </div>
  )
}
