import { ReactNode } from 'react'

interface StaticPageProps {
  badge?: string
  title: string
  subtitle?: string
  children: ReactNode
}

export function StaticPage({ badge, title, subtitle, children }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-primary/10 via-background to-secondary/5 py-16 px-6 text-center">
        {badge && (
          <span className="text-xs font-semibold uppercase tracking-widest bg-secondary/15 text-secondary border border-secondary/30 px-3 py-1 rounded-full mb-4 inline-block">
            {badge}
          </span>
        )}
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{title}</h1>
        {subtitle && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <article
          className="prose prose-lg dark:prose-invert max-w-none
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
