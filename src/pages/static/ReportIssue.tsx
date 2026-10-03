import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import StaticPage from '@/components/layout/StaticPage'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

const SUBJECTS = ['A forum post', 'A reply', "A user's behaviour", 'A private message', 'A subgroup', 'Technical bug', 'Other']
export const CHILD_SAFETY_REASON = 'Child safety (a child at risk, or sexual content involving a minor)'
const REASONS = [CHILD_SAFETY_REASON, 'Hate speech', 'Harassment or bullying', 'Spam or scam', 'False information', 'Privacy violation', 'Threatening content', 'Inappropriate content', 'Other']

export default function ReportIssue() {
  const [submitted, setSubmitted] = useState(false)
  const [subject, setSubject] = useState('')
  const [reason, setReason] = useState('')
  const [link, setLink] = useState('')
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject || !reason || !link.trim()) return
    const description = [link.trim(), details.trim()].filter(Boolean).join('\n\n')
    if (description.length < 20) {
      toast.error('Please describe the problem in a little more detail (at least 20 characters).')
      return
    }
    setSending(true)
    const url = /^https?:\/\//i.test(link.trim()) ? link.trim().slice(0, 500) : null
    const { error } = await supabase.from('issue_reports').insert({
      type: `${reason} | ${subject}`.slice(0, 100),
      description: description.slice(0, 2000),
      page_url: url,
      contact_email: email.trim() || null,
    })
    setSending(false)
    if (error) {
      toast.error('Could not send your report. Please try again, or email support@abiaconnect.com.')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <StaticPage badge="Submitted" title="Report Received" subtitle="Your report has been logged.">
        <div className="not-prose text-center py-8">
          <CheckCircle2 className="w-16 h-16 text-secondary mx-auto mb-4" />
          <p className="text-lg text-foreground mb-6">
            Thank you. Our team will review within 24 hours.
          </p>
          <Button asChild>
            <Link to="/">Return to Forum</Link>
          </Button>
        </div>
      </StaticPage>
    )
  }

  return (
    <StaticPage
      badge="Safety"
      title="Report an Issue"
      subtitle="Help us keep AbiaConnect safe for everyone."
    >
      <p>
        Tell us about content or behaviour that breaks our <Link to="/community-standards">Community Standards</Link>,
        or a technical problem. Reports go straight to our safety team. Reports about child safety are reviewed first.
      </p>
      <p>
        If a child is in immediate danger, contact the police or local emergency services first.
      </p>

      <form onSubmit={submit} className="not-prose bg-card border border-border rounded-2xl p-6 space-y-5 my-6">
        <div>
          <Label>What are you reporting?</Label>
          <Select value={subject} onValueChange={setSubject} required>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="link">Link or description</Label>
          <Textarea
            id="link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste the URL of the content, or describe what you saw..."
            rows={3}
            required
          />
        </div>

        <div>
          <Label>Reason for report</Label>
          <Select value={reason} onValueChange={setReason} required>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="details">Additional details (optional)</Label>
          <Textarea
            id="details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="email">Your contact email (optional)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <p className="text-xs text-muted-foreground mt-1">Only used if we need to follow up with you.</p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? 'Sending…' : 'Submit Report'}
        </Button>
      </form>
    </StaticPage>
  )
}
