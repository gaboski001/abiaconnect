import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { GOLD_GRADIENT, GOLD_SHADOW, PREMIUM_SHADOW } from '@/lib/mobileBrand'

interface PremiumAuthShellProps {
  logoUrl?: string | null
  badge?: string
  title: string
  subtitle: string
  panelTitle?: string
  panelDescription?: string
  children: ReactNode
  footer?: ReactNode
}

export function PremiumAuthShell({
  logoUrl,
  title,
  subtitle,
  children,
  footer,
}: PremiumAuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1F0B] text-slate-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-24 top-[-8rem] h-72 w-72 rounded-full blur-3xl opacity-40" style={{ background: 'rgba(28,169,217,0.35)' }} />
        <div className="absolute -right-16 top-1/4 h-80 w-80 rounded-full blur-3xl opacity-50" style={{ background: 'rgba(248,195,1,0.28)' }} />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full blur-3xl opacity-35" style={{ background: 'rgba(232,112,21,0.30)' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_25%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8 lg:px-8 lg:py-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl lg:flex lg:flex-col lg:justify-center"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/10 p-3"
              style={{ boxShadow: GOLD_SHADOW }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="AbiaConnect" className="h-10 w-10 object-contain" />
              ) : (
                <span className="text-2xl font-black" style={{ backgroundImage: GOLD_GRADIENT, WebkitBackgroundClip: 'text', color: 'transparent' }}>A</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300/70">AbiaConnect</p>
              <h1 className="text-3xl font-black leading-tight text-white xl:text-4xl">{title}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300/78">{subtitle}</p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-[calc(100vh-3rem)] flex-col justify-center"
        >
          <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-[rgba(10,17,31,0.82)] p-5 shadow-2xl backdrop-blur-2xl sm:p-7" style={{ boxShadow: PREMIUM_SHADOW }}>
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/10 p-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="AbiaConnect" className="h-8 w-8 object-contain" />
                ) : (
                  <span className="text-xl font-black" style={{ backgroundImage: GOLD_GRADIENT, WebkitBackgroundClip: 'text', color: 'transparent' }}>A</span>
                )}
              </div>
              <h1 className="text-xl font-black text-white">{title}</h1>
            </div>

            {children}

            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </motion.section>
      </div>
    </div>
  )
}

export default PremiumAuthShell
