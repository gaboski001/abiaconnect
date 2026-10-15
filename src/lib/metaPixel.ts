/**
 * Meta (Facebook) pixel, used only to measure AbiaConnect's own Facebook and
 * Instagram ads. It loads only after a visitor agrees (see AdConsentBanner),
 * never inside the Android app, and never sends what people type or post.
 */

const PIXEL_ID = '1424146082465292'
const CONSENT_KEY = 'abiaconnect-ad-consent'

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: Fbq
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

export type AdConsent = 'granted' | 'denied' | null

function isNative() {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    return Boolean(cap?.isNativePlatform?.())
  } catch {
    return false
  }
}

export function readAdConsent(): AdConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

/** Whether to ask at all: never in the app, and not again once someone has chosen. */
export function shouldAskAdConsent() {
  return typeof window !== 'undefined' && !isNative() && readAdConsent() === null
}

let loaded = false

function load() {
  if (loaded || typeof window === 'undefined' || isNative()) return
  loaded = true
  // Meta's standard loader, written out so nothing runs before consent.
  const queue: Fbq = function (...args: unknown[]) {
    if (queue.callMethod) queue.callMethod(...args)
    else queue.queue.push(args)
  } as Fbq
  queue.push = queue
  queue.loaded = true
  queue.version = '2.0'
  queue.queue = []
  window.fbq = queue
  if (!window._fbq) window._fbq = queue
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  window.fbq('init', PIXEL_ID)
}

export function setAdConsent(choice: 'granted' | 'denied') {
  try {
    localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    // Private browsing: the choice holds for this visit only.
  }
  if (choice === 'granted') {
    load()
    trackPageView()
  }
}

/** Starts the pixel on page load when the visitor agreed on an earlier visit. */
export function startPixelIfAllowed() {
  if (readAdConsent() === 'granted') load()
}

export function trackPageView() {
  if (loaded && window.fbq) window.fbq('track', 'PageView')
}

/** A standard Meta event such as 'CompleteRegistration'; ignored without consent. */
export function trackEvent(name: string) {
  if (loaded && window.fbq) window.fbq('track', name)
}
