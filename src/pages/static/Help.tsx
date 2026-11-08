import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MessageCircleQuestion, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import StaticPage from '@/components/layout/StaticPage'
import { HELP_SECTIONS as SECTIONS } from '@/lib/helpCentre'
import { openSupportChat } from '@/components/support/SupportChat'

export default function Help() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS
    const q = query.toLowerCase()
    return SECTIONS
      .map((s) => ({ ...s, items: s.items.filter((i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0)
  }, [query])

  return (
    <StaticPage
      badge="Support"
      title="Help Center"
      subtitle="Answers to the most common questions about AbiaConnect."
    >
      <div className="not-prose mb-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <MessageCircleQuestion className="size-6 shrink-0 text-secondary" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Prefer to just ask?</span> Type your question in your own words and get an instant answer.
        </p>
        <Button onClick={openSupportChat}>Ask a question</Button>
      </div>

      <div className="not-prose relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the help center..."
          className="pl-10 h-12"
        />
      </div>

      {filtered.map((s) => (
        <section key={s.title} className="not-prose mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">{s.title}</h2>
          <Accordion type="single" collapsible className="border border-border rounded-lg bg-card divide-y divide-border">
            {s.items.map((it, i) => (
              <AccordionItem key={i} value={`${s.title}-${i}`} className="border-b-0 px-4">
                <AccordionTrigger className="text-left text-foreground">{it.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{it.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="not-prose text-center text-muted-foreground py-8">
          No results for “{query}”. Try a different search term.
        </p>
      )}

      <div className="not-prose rounded-xl border border-border bg-muted/30 p-6 text-center mt-8">
        <h3 className="font-semibold text-foreground mb-2">Still need help?</h3>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mb-4">
          <Mail className="w-4 h-4" />
          <a href="mailto:support@abiaconnect.com" className="text-secondary hover:underline">
            support@abiaconnect.com
          </a>
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Button asChild variant="outline">
            <a href="mailto:support@abiaconnect.com">Email Support</a>
          </Button>
          <Button asChild>
            <Link to="/report-issue">Report an Issue</Link>
          </Button>
        </div>
      </div>
    </StaticPage>
  )
}
