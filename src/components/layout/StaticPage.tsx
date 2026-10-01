import { ReactNode } from 'react'

interface StaticPageProps {
  badge?: string
  title: string
  subtitle?: string
  children: ReactNode
}

export function StaticPage({ badge, title, subtitle, children }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-background native:min-h-0 native:bg-transparent">
      {/* In the app the title is in the app bar, so the banner becomes a short intro. */}
      <header className="rounded-3xl border border-border bg-gradient-to-br from-primary/[0.07] via-background to-secondary/[0.08] py-14 px-6 text-center md:py-16 native:rounded-2xl native:border native:border-border native:px-5 native:py-5 native:text-left">
        {badge && (
          <span className="text-xs font-semibold uppercase tracking-widest bg-secondary/15 text-secondary border border-secondary/30 px-3 py-1 rounded-full mb-4 inline-block native:mb-2">
            {badge}
          </span>
        )}
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 native:mb-1 native:text-[22px] native:leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto native:mx-0 native:text-[15px] native:leading-6">{subtitle}</p>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 native:px-1 native:py-6">
        <article
          className="prose prose-lg dark:prose-invert max-w-none native:prose-base native:prose-h2:text-xl native:prose-h3:text-lg
          prose-headings:text-foreground prose-headings:font-semibold
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-li:text-muted-foreground
          prose-strong:text-foreground
          prose-a:text-secondary hover:prose-a:text-secondary/80
          prose-hr:border-border
          prose-blockquote:border-l-secondary prose-blockquote:text-foreground"
        >
          {children}
        </article>
      </main>
    </div>
  )
}

export default StaticPage
