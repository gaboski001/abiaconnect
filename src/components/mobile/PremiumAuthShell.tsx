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
  badge,
  title,
  subtitle,
  panelTitle,
  panelDescription,
  children,
  footer,
}: PremiumAuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111F] text-slate-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-24 top-[-8rem] h-72 w-72 rounded-full blur-3xl opacity-40" style={{ background: 'rgba(28,169,217,0.35)' }} />
        <div className="absolute -right-16 top-1/4 h-80 w-80 rounded-full blur-3xl opacity-50" style={{ background: 'rgba(248,195,1,0.28)' }} />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full blur-3xl opacity-35" style={{ background: 'rgba(232,112,21,0.30)' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_25%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8 lg:py-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl lg:flex lg:flex-col lg:justify-between"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200/80" style={{ background: GOLD_GRADIENT_SOFT }}>
              <Sparkles className="size-4" style={{ color: MOBILE_BRAND.gold }} />
              {badge}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-18 w-18 items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/10 p-3 shadow-2xl"
                  style={{ boxShadow: GOLD_SHADOW }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="AbiaConnect" className="h-12 w-12 object-contain" />
                  ) : (
                    <span className="text-3xl font-black text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, WebkitBackgroundClip: 'text', color: 'transparent' }}>
                      A
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300/70">AbiaConnect Mobile</p>
                  <h1 className="text-4xl font-black leading-tight text-white xl:text-5xl">{title}</h1>
                </div>
              </div>
              <p className="max-w-xl text-base leading-7 text-slate-300/78 xl:text-lg">{subtitle}</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {PANEL_ITEMS.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.08 }}
                  className="rounded-[1.6rem] border border-white/10 bg-slate-950/25 p-4 backdrop-blur-xl"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                    <item.icon className="size-5" style={{ color: MOBILE_BRAND.gold }} />
                  </div>
                  <h2 className="text-sm font-bold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300/72">{item.copy}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.8rem] border border-white/10 p-5" style={{ background: BLUE_GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-black/20 text-slate-950">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="mt-5 text-2xl font-black text-slate-950">{panelTitle}</h3>
              <p className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-950/80">{panelDescription}</p>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/30 p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300/60">Why it feels premium</p>
              <ul className="mt-4 space-y-3">
                {AUTH_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200/78">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: GOLD_GRADIENT }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-[calc(100vh-3rem)] flex-col justify-center"
        >
          <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-[rgba(10,17,31,0.82)] p-5 shadow-2xl backdrop-blur-2xl sm:p-7" style={{ boxShadow: PREMIUM_SHADOW }}>
            <div className="mb-6 flex flex-col gap-4 sm:hidden">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200/80" style={{ background: GOLD_GRADIENT_SOFT }}>
                <Sparkles className="size-4" style={{ color: MOBILE_BRAND.gold }} />
                {badge}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] border border-white/10 bg-white/10 p-2.5">
                  {logoUrl ? (
                    <img src={logoUrl} alt="AbiaConnect" className="h-10 w-10 object-contain" />
                  ) : (
                    <span className="text-2xl font-black" style={{ backgroundImage: GOLD_GRADIENT, WebkitBackgroundClip: 'text', color: 'transparent' }}>A</span>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">{title}</h1>
                  <p className="mt-1 text-sm leading-6 text-slate-300/72">{subtitle}</p>
                </div>
              </div>
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
