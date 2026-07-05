import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import { GOLD_GRADIENT, GOLD_SHADOW, PREMIUM_SHADOW } from '@/lib/mobileBrand'

/**
 * Android-tuned auth chrome.
 *
 * Rendered ONLY inside the installed native app (Capacitor). The web build,
 * including the mobile browser view, is not affected — callers guard with
 * `Capacitor.isNativePlatform()` and fall back to the existing web JSX.
 */
export interface NativeAuthLayoutProps {
  title: string
  subtitle?: string
  logoUrl?: string | null
  siteName?: string
  children: ReactNode
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export function NativeAuthLayout({
  title,
  subtitle,
  logoUrl,
  siteName,
  children,
}: NativeAuthLayoutProps) {
  return (
    <div
      className="dark relative min-h-screen overflow-hidden bg-[#0B1F0B] text-slate-50"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      {/* Subtle brand backdrop — no heavy animation, keeps native paint cheap */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -right-16 top-[-4rem] h-72 w-72 rounded-full blur-3xl opacity-40"
          style={{ background: 'rgba(248,195,1,0.25)' }}
        />
        <div
          className="absolute -left-20 bottom-[-4rem] h-72 w-72 rounded-full blur-3xl opacity-35"
          style={{ background: 'rgba(28,80,40,0.55)' }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-6 flex flex-col items-center text-center"
        >
          <div
            className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/10 p-3"
            style={{ boxShadow: GOLD_SHADOW }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={siteName || 'AbiaConnect'}
                className="h-16 w-16 object-contain"
              />
            ) : (
              <span
                className="text-3xl font-black"
                style={{
                  backgroundImage: GOLD_GRADIENT,
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {(siteName || 'A').charAt(0)}
              </span>
            )}
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300/70">
            {siteName || 'AbiaConnect'}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-white">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-300/80">{subtitle}</p>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mt-6 flex-1"
        >
          <div
            className="rounded-[1.75rem] border border-white/10 bg-[rgba(10,20,14,0.82)] p-5 backdrop-blur-2xl"
            style={{ boxShadow: PREMIUM_SHADOW }}
          >
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default NativeAuthLayout
