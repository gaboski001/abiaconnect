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

const SUBJECTS = ['A forum post', 'A reply', "A user's behaviour", 'A private message', 'A subgroup', 'Technical bug', 'Other']
const REASONS = ['Hate speech', 'Harassment or bullying', 'Spam or scam', 'False information', 'Privacy violation', 'Threatening content', 'Inappropriate content', 'Other']

export default function ReportIssue() {
  const [submitted, setSubmitted] = useState(false)
  const [subject, setSubject] = useState('')
  const [reason, setReason] = useState('')
  const [link, setLink] = useState('')
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject || !reason || !link.trim()) return
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
        Load the security issues from the scan results and fix the selected issues.
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

        <Button type="submit" size="lg" className="w-full">Submit Report</Button>
      </form>
    </StaticPage>
  )
}
