import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
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

const ISSUE_TYPES = [
  'Bug or technical error',
  'Broken page or link',
  'Image not loading',
  'Account or login problem',
  'Content or moderation issue',
  'Suggestion or feature request',
  'Other',
]

const schema = z.object({
  type: z.string().min(1, 'Please choose an issue type'),
  page_url: z.string().trim().max(500).optional().or(z.literal('')),
  description: z
    .string()
    .trim()
    .min(20, 'Please describe the issue in at least 20 characters')
    .max(1000, 'Maximum 1000 characters'),
  contact_email: z
    .string()
    .trim()
    .email('Please enter a valid email')
    .max(255)
    .optional()
    .or(z.literal('')),
})
type FormValues = z.infer<typeof schema>

export default function ReportIssue() {
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: '', page_url: '', description: '', contact_email: '' },
  })

  const description = watch('description') || ''
  const type = watch('type')

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.from('issue_reports').insert({
      type: values.type,
      page_url: values.page_url || null,
      description: values.description,
      contact_email: values.contact_email || null,
    })
    if (error) {
      toast.error('Could not submit report. Please try again.')
      return
    }
    setSubmitted(true)
  }

  return (
    <StaticPage
      badge="Contact Support"
      title="Report an Issue"
      subtitle="Found a bug, broken feature, or something that doesn't look right? Tell us."
    >
      {submitted ? (
        <div className="not-prose text-center py-10 rounded-xl border border-border bg-card">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Thank you for your report.</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            We have received your report and will investigate within 2–3 business days. Our team
            takes every report seriously.
          </p>
          <Button asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="not-prose space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <Label htmlFor="type">Issue Type</Label>
            <Select value={type} onValueChange={(v) => setValue('type', v, { shouldValidate: true })}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Choose an issue type" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="page_url">Page or URL where the issue occurred</Label>
            <Input
              id="page_url"
              placeholder="e.g. https://abiaconnect.com/dashboard"
              {...register('page_url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description of the issue</Label>
            <Textarea
              id="description"
              rows={6}
              maxLength={1000}
              placeholder="Please describe what happened, what you expected to happen, and any steps that led to the issue."
              {...register('description')}
            />
            <div className="flex justify-between text-xs">
              {errors.description ? (
                <span className="text-destructive">{errors.description.message}</span>
              ) : (
                <span className="text-muted-foreground">Minimum 20 characters</span>
              )}
              <span className="text-muted-foreground">{description.length} / 1000</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">Your email address</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="you@example.com"
              {...register('contact_email')}
            />
            <p className="text-xs text-muted-foreground">
              Optional — provide your email if you would like us to follow up with you directly.
            </p>
            {errors.contact_email && (
              <p className="text-xs text-destructive">{errors.contact_email.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Submitting…' : 'Submit Report'}
          </Button>
        </form>
      )}
    </StaticPage>
  )
}
