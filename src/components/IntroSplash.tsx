import { useEffect, useState } from 'react'
import introLogo from '@/assets/intro-logo.gif.asset.json'

const STORAGE_KEY = 'abia_intro_seen_v1'

export function IntroSplash() {
  const [show, setShow] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return
    } catch {}
    setShow(true)
    const fadeTimer = setTimeout(() => setFadeOut(true), 2400)
    const hideTimer = setTimeout(() => {
      setShow(false)
      try { sessionStorage.setItem(STORAGE_KEY, '1') } catch {}
    }, 3000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!show) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at center, hsl(var(--background) / 0.96) 0%, hsl(var(--background) / 0.9) 60%, hsl(var(--background) / 0.75) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <img
        src={introLogo.url}
        alt=""
        className="max-w-[70vw] max-h-[60vh] w-auto h-auto animate-scale-in"
        style={{ filter: 'drop-shadow(0 20px 60px hsl(var(--primary) / 0.35))' }}
      />
    </div>
  )
}
