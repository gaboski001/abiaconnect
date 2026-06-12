import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import StaticPage from '@/components/layout/StaticPage'

interface QA { q: string; a: string }
const SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: 'Getting Started',
    items: [
      { q: 'How do I create an AbiaConnect account?', a: 'Click "Join Free" in the top navigation bar. Complete the two-step registration: enter your personal details, then pass the quick Abia State verification quiz. After registration, verify your email to activate your account.' },
      { q: 'Why do I need to verify I am from Abia State?', a: 'AbiaConnect is built for Abia State indigenes and friends of Abia. The verification step maintains the cultural identity and trust that make this community special. Non-indigenes who love Abia are welcome — select the non-indigene option during registration.' },
      { q: 'I did not receive my verification email. What should I do?', a: 'Check your spam or junk folder first. If it is not there, go to the Login page and click "Resend verification email." If problems persist, contact support@abiaconnect.com.' },
    ],
  },
  {
    title: 'Posting and Threads',
    items: [
      { q: 'How do I start a new discussion thread?', a: 'Click "Start a Discussion" on the homepage or navigate to any category and click "New Thread." You must be logged in to post. Select a category, write a clear title, and add your content. Tags help others find your thread.' },
      { q: 'Can I edit or delete my post after publishing?', a: 'Yes. Click the three-dot menu on your post to edit or delete. Deleting a thread removes all replies — please consider this carefully before deleting.' },
      { q: 'What are pinned threads?', a: 'Pinned threads are placed at the top of a category by our moderation team because they contain important or especially useful information. Only administrators and moderators can pin threads.' },
    ],
  },
  {
    title: 'Account and Profile',
    items: [
      { q: 'How do I change my profile picture?', a: 'Go to Dashboard then Settings then Profile Picture. Click the upload area and select an image from your device. We recommend a square image at least 200x200 pixels in JPG, PNG, or WebP format.' },
      { q: 'Can I change my username?', a: 'Usernames can be changed once every 30 days. Go to Dashboard then Settings and update the username field. Your old username is released for others after 7 days.' },
      { q: 'How do I delete my account?', a: 'Go to Dashboard then Settings then Danger Zone. Click "Delete Account" and type DELETE to confirm. This is permanent. Contact support@abiaconnect.com within 14 days if you change your mind.' },
    ],
  },
  {
    title: 'Safety and Reporting',
    items: [
      { q: 'How do I report a post or user?', a: "Click the three-dot menu on any post or the flag icon on a user's profile. Select a reason and add details. Our team reviews every report within 24 hours." },
      { q: 'What happens after I report someone?', a: 'Our moderation team reviews the report. If a violation is confirmed, action is taken ranging from a warning to a permanent ban. Reports are confidential.' },
      { q: 'I am being harassed by another member. What should I do?', a: 'Report the posts using the Report button. You can also block the user from your profile settings. For severe harassment, email moderation@abiaconnect.com with screenshots.' },
    ],
  },
]

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
