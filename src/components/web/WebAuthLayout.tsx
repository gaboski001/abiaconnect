import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Lock } from 'lucide-react'
import { SiteLogo } from '@/components/layout/SiteLogo'

const BENEFITS = [
  'Join thoughtful discussions on the issues that matter to Abia',
  'Connect with professionals, partners and friends worldwide',
  'Take part in community polls, contests and elections',
]

/**
 * Website sign-in / sign-up frame: a branded panel beside the form on wide
 * screens, a simple card on phones. (The app has its own native auth screens.)
 */
export function WebAuthLayout({
  title,
  subtitle,
  notice,
  children,
}: {
  title: string
  subtitle?: string
  /** Short message above the form, e.g. why the visitor was asked to sign in. */
  notice?: string | null
  children: ReactNode
}) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-[1fr_1.1fr]">
      <aside className="brand-panel relative hidden flex-col justify-between p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: 'radial-gradient(60% 50% at 80% 10%, rgba(248,195,1,0.45), transparent 70%)' }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">AbiaConnect</p>
          <p className="web-serif mt-4 text-3xl font-semibold leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            The trusted digital home for Abians worldwide.
          </p>
          <ul className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-3 text-[15px] leading-6 text-primary-foreground/90">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-primary-foreground/70">
          <Lock className="size-4" aria-hidden /> Your details are private and never sold.
        </p>
      </aside>

      <div className="p-6 sm:p-10">
        <Link to="/" aria-label="AbiaConnect home" className="inline-flex">
          <SiteLogo imageClassName="h-10 max-w-[170px]" />
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-muted-foreground">{subtitle}</p> : null}
        {notice ? (
          <p className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-foreground">{notice}</p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export default WebAuthLayout
