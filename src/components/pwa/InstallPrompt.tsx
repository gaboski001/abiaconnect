import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  isIOS,
  isStandalone,
  setDeferredPrompt,
  getDeferredPrompt,
  setIOSFlag,
} from '@/lib/pwaInstall'

const IOS_KEY = 'abiaconnect_install_ios_state'
const ANDROID_KEY = 'abiaconnect_install_android_state'
// Legacy combined key — migrate on first read so existing users aren't re-prompted.
const LEGACY_KEY = 'abiaconnect_install_dismissed'
const ICON = '/icons/icon-192x192.png'

type InstallState = 'dismissed' | 'accepted'

const readState = (key: string): InstallState | null => {
  try {
    const v = localStorage.getItem(key) || localStorage.getItem(LEGACY_KEY)
    return v === 'accepted' || v === 'dismissed' ? v : v ? 'dismissed' : null
  } catch {
    return null
  }
}

const writeState = (key: string, value: InstallState) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const deferred = useRef<BIPEvent | null>(null)
  const platformKey = useRef<string>(ANDROID_KEY)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const iosDialogRef = useRef<HTMLDivElement | null>(null)
  const iosReturnFocus = useRef<HTMLElement | null>(null)



  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return

    const ios = isIOS()
    platformKey.current = ios ? IOS_KEY : ANDROID_KEY
    if (readState(platformKey.current)) return

    const onBIP = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BIPEvent
    }
    const onInstalled = () => {
      writeState(platformKey.current, 'accepted')
      setVisible(false)
      toast.success('🎉 AbiaConnect installed! Welcome to the community.', { duration: 3000 })
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)

    const t = window.setTimeout(() => {
      if (deferred.current || ios) setVisible(true)
    }, 8000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    setClosing(true)
    writeState(platformKey.current, 'dismissed')
    window.setTimeout(() => setVisible(false), 300)
  }

  const install = async () => {
    if (deferred.current) {
      try {
        await deferred.current.prompt()
        const { outcome } = await deferred.current.userChoice
        if (outcome === 'accepted') {
          writeState(ANDROID_KEY, 'accepted')
          setVisible(false)
        }
      } catch {
        /* ignore */
      }
      deferred.current = null
    } else if (isIOS()) {
      setShowIOS(true)
    }
  }

  // Escape dismisses the banner (when iOS modal isn't open).
  useEffect(() => {
    if (!visible || showIOS) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        dismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, showIOS])

  // iOS modal: focus trap, Escape to close, restore focus on close.
  useEffect(() => {
    if (!showIOS) return
    iosReturnFocus.current = document.activeElement as HTMLElement | null
    const root = iosDialogRef.current
    const focusables = () =>
      root
        ? Array.from(
            root.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          )
        : []
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setShowIOS(false)
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      iosReturnFocus.current?.focus?.()
    }
  }, [showIOS])

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes ac-up { from { transform: translateY(120%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes ac-down { from { transform: translateY(0); opacity: 1 } to { transform: translateY(120%); opacity: 0 } }
        @keyframes ac-pulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.35); opacity: .6 } }
        .ac-card { animation: ac-up .4s ease-out both }
        .ac-card.ac-closing { animation: ac-down .3s ease-in both }
        .ac-dot { animation: ac-pulse 1.6s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .ac-card, .ac-card.ac-closing, .ac-dot { animation: none !important }
        }
        .ac-btn:focus-visible { outline: 2px solid #1a4f3a; outline-offset: 2px }
      `}</style>
      <div
        ref={cardRef}
        role="region"
        aria-labelledby="ac-install-title"
        aria-describedby="ac-install-desc"
        className={`ac-card ${closing ? 'ac-closing' : ''} fixed z-[60] left-3 right-3 bottom-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px] rounded-2xl bg-white text-neutral-900 shadow-2xl border border-neutral-200 p-4`}
        style={{ borderRadius: 16 }}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <img src={ICON} alt="" width={48} height={48} className="rounded-xl" />
            <span
              aria-hidden="true"
              className="ac-dot absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
              style={{ background: '#1a4f3a' }}
            />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h2 id="ac-install-title" className="font-semibold text-[15px] leading-tight m-0">
              Install AbiaConnect
            </h2>
            <p id="ac-install-desc" className="text-[13px] text-neutral-600 mt-1 leading-snug">
              Get the full community experience — faster, offline-ready, and always at hand.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {/* 1: primary action */}
              <button
                type="button"
                tabIndex={0}
                onClick={install}
                aria-label="Install AbiaConnect app"
                className="ac-btn px-3.5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-95 transition"
                style={{ background: '#1a4f3a' }}
              >
                Install App
              </button>
              {/* 2: secondary action */}
              <button
                type="button"
                tabIndex={0}
                onClick={dismiss}
                aria-label="Not now, hide install prompt"
                className="ac-btn px-3 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
        {/* 3: tertiary close — last in tab order, visually top-right */}
        <button
          type="button"
          tabIndex={0}
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="ac-btn absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>


      {showIOS && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 grid place-items-end sm:place-items-center p-4"
          onClick={() => setShowIOS(false)}
        >
          <div
            ref={iosDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ac-ios-title"
            aria-describedby="ac-ios-steps"
            className="relative bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: 16 }}
          >
            <h2 id="ac-ios-title" className="font-semibold text-base mb-2 text-neutral-900 m-0 pr-8">
              Install AbiaConnect
            </h2>
            <ol id="ac-ios-steps" className="text-sm text-neutral-700 space-y-2 list-decimal pl-5">
              <li>Tap the <strong>Share</strong> button (□↑) in your browser</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> — and you're in!</li>
            </ol>
            <div className="mt-3 flex justify-center" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a4f3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
            {/* 1: primary confirm */}
            <button
              type="button"
              tabIndex={0}
              onClick={() => setShowIOS(false)}
              className="ac-btn mt-3 w-full px-3 py-2 text-sm font-medium text-white rounded-lg"
              style={{ background: '#1a4f3a' }}
            >
              Got it
            </button>
            {/* 2: secondary close — last in tab order */}
            <button
              type="button"
              tabIndex={0}
              onClick={() => setShowIOS(false)}
              aria-label="Close install instructions"
              className="ac-btn absolute top-2 right-2 h-7 w-7 grid place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

        </div>
      )}
    </>
  )
}

