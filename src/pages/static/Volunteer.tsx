import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StaticPage from '@/components/layout/StaticPage'
import { SEO } from '@/components/SEO'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { HOURS_OPTIONS, VOLUNTEER_ROLES, volunteerRole } from '@/lib/volunteerRoles'

const MIN_TEXT = 30

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="flex items-center gap-3 text-base font-semibold text-foreground">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {step}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function Counter({ value, min }: { value: string; min: number }) {
  const n = value.trim().length
  if (n >= min) return null
  return <p className="mt-1 text-xs text-muted-foreground">{n === 0 ? `At least ${min} characters.` : `${min - n} more characters needed.`}</p>
}

export default function Volunteer() {
  const { user } = useAuth()
  const [params] = useSearchParams()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [lga, setLga] = useState('')
  const [roleId, setRoleId] = useState(() => volunteerRole(params.get('role'))?.id ?? '')
  const [hours, setHours] = useState('')
  const [motivation, setMotivation] = useState('')
  const [experience, setExperience] = useState('')
  const [links, setLinks] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [agreed, setAgreed] = useState(false)
  // Hidden from people; automated spam fills it and is quietly dropped.
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const role = volunteerRole(roleId)

  // A signed-in member's email is filled in for them (they can change it).
  useEffect(() => {
    if (user?.email) setEmail((current) => current || user.email!)
  }, [user?.email])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) return toast.error('Please choose the role you are applying for.')
    if (!hours) return toast.error('Please choose how much time you can give each week.')
    if (motivation.trim().length < MIN_TEXT || experience.trim().length < MIN_TEXT) {
      return toast.error('Please write a little more about your motivation and your experience.')
    }
    const unanswered = role.questions.find((q) => !(answers[q.question] ?? '').trim())
    if (unanswered) return toast.error(`Please answer: "${unanswered.question}"`)
    if (!agreed) return toast.error('Please tick the box to confirm the statements at the end of the form.')

    setSending(true)
    const { data, error } = await supabase.functions.invoke('volunteer-apply', {
      body: {
        fullName,
        email,
        phone,
        location,
        lga,
        role: role.id,
        hoursPerWeek: hours,
        motivation,
        experience,
        links,
        answers: role.questions.map((q) => ({ question: q.question, answer: (answers[q.question] ?? '').trim() })),
        website,
      },
    })
    setSending(false)

    if (error || !data?.ok) {
      // The function answers with a friendly { error } message; show that when there is one.
      let message: string | undefined = data?.error
      try {
        message ??= (await (error as { context?: Response } | null)?.context?.json())?.error
      } catch {
        /* ignore */
      }
      toast.error(message || 'We could not send your application. Please try again, or email support@abiaconnect.com.')
      return
    }
    setSentTo(email.trim())
    window.scrollTo({ top: 0 })
  }

  if (sentTo) {
    return (
      <StaticPage badge="Submitted" title="Application Received" subtitle="Thank you for offering your time to AbiaConnect.">
        <div className="not-prose py-6 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-secondary" />
          <p className="mx-auto mb-2 max-w-xl text-lg text-foreground">
            We are pleased that you want to serve the community. Our team will review your application and email you our
            decision, usually within 7 days.
          </p>
          <p className="mx-auto mb-6 max-w-xl text-sm text-muted-foreground">
            A confirmation is on its way to <strong className="text-foreground">{sentTo}</strong>. If you do not see it in a
            few minutes, please check your spam folder.
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
      badge="Join Us"
      title="Volunteer With AbiaConnect"
      subtitle="Give a few hours a week to the community that connects Abians everywhere."
    >
      <SEO
        title="Volunteer with AbiaConnect"
        description="Apply to volunteer with AbiaConnect as a moderator, writer, social media coordinator, developer or community connector."
        path="/volunteer"
      />
      <p>
        Thank you for your interest. Fill in the form below and our team will review it. It takes about 10 minutes, and
        every question helps us place you where you will do the most good. Volunteer roles are unpaid.
      </p>

      <form onSubmit={submit} className="not-prose my-6 space-y-8 rounded-2xl border border-border bg-card p-6">
        <Section step={1} title="About you">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="v-name">Full name</Label>
              <Input id="v-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="v-email">Email address</Label>
              <Input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} required autoComplete="email" />
              <p className="mt-1 text-xs text-muted-foreground">We send our decision to this address.</p>
            </div>
            <div>
              <Label htmlFor="v-phone">Phone or WhatsApp number (optional)</Label>
              <Input id="v-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+234 801 234 5678" autoComplete="tel" />
            </div>
            <div>
              <Label htmlFor="v-location">Where you live now</Label>
              <Input id="v-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} required placeholder="Town or city, and country" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="v-lga">LGA of origin in Abia State (optional)</Label>
              <Input id="v-lga" value={lga} onChange={(e) => setLga(e.target.value)} maxLength={60} placeholder="For example: Bende. Leave empty if you are not from Abia State." />
            </div>
          </div>
        </Section>

        <Section step={2} title="The role">
          <div>
            <Label id="v-role-label">Which role are you applying for?</Label>
            <Select value={roleId} onValueChange={(v) => setRoleId(v as typeof roleId)}>
              <SelectTrigger aria-labelledby="v-role-label">
                <SelectValue placeholder="Choose a role..." />
              </SelectTrigger>
              <SelectContent>
                {VOLUNTEER_ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role && <p className="mt-1 text-sm text-muted-foreground">{role.summary}</p>}
          </div>
          <div>
            <Label id="v-hours-label">How much time can you give each week?</Label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger aria-labelledby="v-hours-label">
                <SelectValue placeholder="Choose..." />
              </SelectTrigger>
              <SelectContent>
                {HOURS_OPTIONS.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section step={3} title="Your motivation and experience">
          <div>
            <Label htmlFor="v-motivation">Why do you want to volunteer with AbiaConnect?</Label>
            <Textarea id="v-motivation" value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={4} maxLength={2000} required placeholder="Tell us what draws you to this community and what you hope to add to it." />
            <Counter value={motivation} min={MIN_TEXT} />
          </div>
          <div>
            <Label htmlFor="v-experience">What experience or skills do you bring?</Label>
            <Textarea id="v-experience" value={experience} onChange={(e) => setExperience(e.target.value)} rows={4} maxLength={2000} required placeholder="Work, study, voluntary work or personal projects that relate to the role." />
            <Counter value={experience} min={MIN_TEXT} />
          </div>
          <div>
            <Label htmlFor="v-links">Links (optional)</Label>
            <Input id="v-links" value={links} onChange={(e) => setLinks(e.target.value)} maxLength={500} placeholder="LinkedIn, a portfolio or your AbiaConnect username" />
          </div>
        </Section>

        {role && (
          <Section step={4} title={`Questions for ${role.name === 'Another way to help' ? 'you' : `a ${role.name}`}`}>
            {role.questions.map((q, i) => (
              <div key={q.question}>
                <Label htmlFor={`v-q-${i}`}>{q.question}</Label>
                <Textarea
                  id={`v-q-${i}`}
                  value={answers[q.question] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.question]: e.target.value }))}
                  rows={3}
                  maxLength={2000}
                  required
                  placeholder={q.hint}
                />
              </div>
            ))}
          </Section>
        )}

        <div className="space-y-4 border-t border-border pt-6">
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          <div className="flex items-start gap-3">
            <Checkbox id="v-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-1" />
            <Label htmlFor="v-agree" className="text-sm font-normal leading-relaxed text-muted-foreground">
              I am 18 or older, the information I have given is true, I understand that this is an unpaid volunteer role,
              and I agree to follow the{' '}
              <Link to="/community-standards" className="text-secondary underline">
                Community Standards
              </Link>
              . I agree that AbiaConnect may contact me about this application, as described in the{' '}
              <Link to="/privacy-policy" className="text-secondary underline">
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={sending}>
            {sending ? 'Sending…' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </StaticPage>
  )
}
