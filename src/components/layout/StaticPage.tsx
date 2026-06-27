import { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { GOLD_GRADIENT_SOFT, MOBILE_BRAND, PREMIUM_SHADOW } from '@/lib/mobileBrand'

interface StaticPageProps {
  badge?: string
  title: string
  subtitle?: string
  children: ReactNode
}

export function StaticPage({ badge, title, subtitle, children }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#050a12_0%,#091220_48%,#050a12_100%)]">
      <header className="px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-slate-200/80 bg-white/96 p-6 text-slate-950 sm:p-8 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-white"
          style={{ boxShadow: PREMIUM_SHADOW }}
        >
          <div className="absolute inset-0 opacity-75 dark:opacity-100" style={{ background: 'radial-gradient(circle at top right, rgba(248,195,1,0.16), transparent 32%), radial-gradient(circle at bottom left, rgba(28,169,217,0.16), transparent 36%)' }} />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              {badge ? (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/82"
                  style={{ background: GOLD_GRADIENT_SOFT }}
                >
                  <Sparkles className="size-3.5" style={{ color: MOBILE_BRAND.gold }} />
                  {badge}
                </span>
              ) : null}
            </div>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl md:text-5xl dark:text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-4 text-base leading-8 text-slate-700 sm:text-lg dark:text-slate-300/80">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
        <article
          className="rounded-[2rem] border border-slate-200/80 bg-white/96 p-6 text-slate-800 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.22)] sm:p-8 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)] dark:text-slate-200 dark:shadow-none"
        >
          <div
            className="prose prose-slate prose-lg max-w-none
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-950
              prose-p:text-slate-700 prose-p:leading-8
              prose-li:text-slate-700 prose-li:leading-8
              prose-strong:text-slate-950
              prose-a:text-slate-900 prose-a:underline prose-a:decoration-[rgba(248,195,1,0.55)] prose-a:underline-offset-4 hover:prose-a:text-slate-950
              prose-hr:border-slate-200 prose-blockquote:border-l-[3px] prose-blockquote:border-l-[rgba(248,195,1,0.8)] prose-blockquote:text-slate-900
              prose-code:text-slate-900 prose-pre:bg-slate-950 prose-pre:text-slate-100
              dark:prose-invert dark:prose-headings:text-white dark:prose-p:text-slate-300 dark:prose-li:text-slate-300 dark:prose-strong:text-white dark:prose-a:text-slate-100 dark:prose-hr:border-white/10 dark:prose-blockquote:text-slate-100"
          >
            {children}
          </div>
        </article>
      </main>
    </div>
  )
}

export default StaticPage
