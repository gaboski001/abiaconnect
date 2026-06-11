import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      {
        q: 'How do I create an account on AbiaConnect?',
        a: 'Click "Join Free" in the top navigation bar. You will be asked for your name, email address, a username, and your LGA of origin. You will also complete a short Abia State verification quiz — this helps us maintain the authenticity of our community. After registration, check your email for a confirmation link.',
      },
      {
        q: 'Is AbiaConnect free to join?',
        a: 'Yes. Creating an account and participating in the forum is completely free. There are no hidden charges for standard membership.',
      },
      {
        q: 'I did not receive my confirmation email. What should I do?',
        a: 'Check your spam or junk folder first. If it is not there, go to the Login page and click "Resend confirmation email." If the problem persists, contact us at support@abiaconnect.com.',
      },
    ],
  },
  {
    title: 'Your Account',
    items: [
      {
        q: 'How do I change my profile picture?',
        a: 'Go to Dashboard → Settings. Scroll to the Profile Picture section and click the upload area. You can upload a JPG, PNG, or WebP image. Maximum file size is 2MB. Your new picture will appear immediately across the platform.',
      },
      {
        q: 'How do I change my username or display name?',
        a: 'Go to Dashboard → Settings → Profile Information. You can update your display name at any time. Username changes are limited to once every 30 days.',
      },
      {
        q: 'How do I reset my password?',
        a: 'On the Login page, click "Forgot Password?" and enter your email address. You will receive a password reset link within a few minutes. The link expires after 1 hour for security.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Dashboard → Settings → Danger Zone. Click "Delete Account" and type DELETE to confirm. This is permanent and cannot be undone. Your posts will be anonymised and remain on the forum.',
      },
    ],
  },
  {
    title: 'Posting & Forums',
    items: [
      {
        q: 'How do I start a new thread?',
        a: 'Click "Start a Discussion" on the homepage or "New Thread" in any category. Choose the correct category, write your title and content, add tags, and submit. You must be logged in to post.',
      },
      {
        q: 'Can I edit or delete my post after publishing?',
        a: 'Yes. You can edit or delete your own threads and replies from the post menu (three-dot icon). Note that moderators may lock threads to prevent further edits in some cases.',
      },
      {
        q: 'Why was my post removed?',
        a: 'Posts are removed when they violate our Forum Guidelines. You will receive a notification explaining the reason. If you believe the removal was an error, contact moderation@abiaconnect.com.',
      },
    ],
  },
  {
    title: 'Subgroups & Messages',
    items: [
      {
        q: 'How do I join a subgroup?',
        a: 'Go to the Subgroups page and click "Join" on any public subgroup. Private subgroups require approval from the group moderator.',
      },
      {
        q: 'How do I send a private message?',
        a: 'Go to Messages (in the navigation menu after logging in). Click "New Message", search for the member by name or username, and start typing.',
      },
    ],
  },
  {
    title: 'Technical Issues',
    items: [
      {
        q: 'The site is not loading properly. What should I do?',
        a: 'Try a hard refresh (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac). If the problem persists, clear your browser cache or try a different browser. For ongoing issues, report them at /report-issue.',
      },
      {
        q: 'I found a bug or security issue. Who do I contact?',
        a: 'Report bugs at /report-issue. For security vulnerabilities, please email security@abiaconnect.com directly rather than posting publicly.',
      },
    ],
  },
]

export default function Help() {
  return (
    <StaticPage
      badge="Support"
      title="Help Center"
      subtitle="Find answers to common questions about using AbiaConnect."
    >
      {SECTIONS.map((s) => (
        <section key={s.title} className="not-prose mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-3">{s.title}</h2>
          <Accordion type="single" collapsible className="border border-border rounded-lg bg-card divide-y divide-border">
            {s.items.map((it, i) => (
              <AccordionItem key={i} value={`${s.title}-${i}`} className="border-b-0 px-4">
                <AccordionTrigger className="text-left text-foreground">{it.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {it.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}

      <div className="not-prose rounded-xl border border-border bg-muted/30 p-6 text-center mt-8">
        <h3 className="font-semibold text-foreground mb-2">Still need help?</h3>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mb-4">
          <Mail className="w-4 h-4" />
          <a href="mailto:support@abiaconnect.com" className="text-secondary hover:underline">
            support@abiaconnect.com
          </a>
        </p>
        <Button asChild>
          <Link to="/report-issue">Report an Issue</Link>
        </Button>
      </div>
    </StaticPage>
  )
}
