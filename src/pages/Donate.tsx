import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Loader2, Users, Target, Sparkles, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SEO } from '@/components/SEO'
import { formatDistanceToNow } from 'date-fns'

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'] as const

const donationSchema = z.object({
  donor_name: z.string().trim().min(1, 'Name is required').max(100),
  donor_email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  amount: z.number().positive('Amount must be greater than 0').max(1_000_000_000),
  currency: z.enum(CURRENCIES),
  message: z.string().trim().max(500).optional().or(z.literal('')),
  is_anonymous: z.boolean(),
  payment_method: z.string(),
  reference: z.string().trim().max(120).optional().or(z.literal('')),
})

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

interface PublicDonation {
  id: string
  donor_name: string
  amount: number
  currency: string
  message: string | null
  is_anonymous: boolean
  created_at: string
}

interface Totals {
  currency: string
  total: number
  donor_count: number
}

export default function Donate() {
  const qc = useQueryClient()
  const { settings } = useSiteSettings()

  const defaultCurrency = (settings.donation_currency as string) || 'NGN'
  const goal = Number(settings.donation_goal || 0)
  const intro =
    (settings.donation_intro as string) ||
    'AbiaConnect is a non-profit, community-driven platform. Your support keeps it running.'
  const bankDetails = (settings.donation_bank_details as string) || ''
  const suggested = useMemo(
    () =>
      (settings.donation_suggested_amounts || '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0),
    [settings.donation_suggested_amounts],
  )
  const donationsEnabled = (settings.donation_enabled ?? 'true') !== 'false'

  const [form, setForm] = useState({
    donor_name: '',
    donor_email: '',
    amount: '',
    currency: defaultCurrency,
    message: '',
    is_anonymous: false,
    payment_method: 'bank_transfer',
    reference: '',
  })
  const [copied, setCopied] = useState(false)

  const { data: recent } = useQuery({
    queryKey: ['donations-public'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_donations', { _limit: 12 })
      if (error) throw error
      return (data ?? []) as PublicDonation[]
    },
    refetchInterval: 30_000,
  })

  const { data: totals } = useQuery({
    queryKey: ['donations-totals'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_donation_totals')
      if (error) throw error
      return (data ?? []) as Totals[]
    },
    refetchInterval: 30_000,
  })

  const totalInDefault =
    totals?.find((t) => t.currency === defaultCurrency)?.total ?? 0
  const donorCount = totals?.reduce((sum, t) => sum + Number(t.donor_count), 0) ?? 0
  const progress = goal > 0 ? Math.min(100, (Number(totalInDefault) / goal) * 100) : 0

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = donationSchema.parse({
        ...form,
        amount: Number(form.amount),
      })
      const { error } = await supabase.from('donations').insert({
        donor_name: parsed.donor_name,
        donor_email: parsed.donor_email || null,
        amount: parsed.amount,
        currency: parsed.currency,
        message: parsed.message || null,
        is_anonymous: parsed.is_anonymous,
        payment_method: parsed.payment_method,
        reference: parsed.reference || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Thank you! Your donation was submitted and will be confirmed shortly.')
      setForm({
        donor_name: '',
        donor_email: '',
        amount: '',
        currency: defaultCurrency,
        message: '',
        is_anonymous: false,
        payment_method: 'bank_transfer',
        reference: '',
      })
      qc.invalidateQueries({ queryKey: ['donations-public'] })
      qc.invalidateQueries({ queryKey: ['donations-totals'] })
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.errors[0]?.message : (e as Error).message
      toast.error(msg || 'Could not submit donation')
    },
  })

  const copyBank = async () => {
    try {
      await navigator.clipboard.writeText(bankDetails)
      setCopied(true)
      toast.success('Bank details copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Donate to AbiaConnect"
        description="Support AbiaConnect — a non-profit, community-driven platform connecting Abians worldwide. Every donation keeps our servers running and our community growing."
        path="/donate"
      />

      {/* Hero */}
      <header className="bg-gradient-to-br from-primary/10 via-background to-secondary/5 py-16 px-6 text-center border-b border-border">
        <Badge variant="secondary" className="mb-4">
          <Heart className="size-3 mr-1" /> Non-profit · 100% community-funded
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Support AbiaConnect
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {intro}
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid lg:grid-cols-3 gap-8">
        {/* Left: Progress + form */}
        <div className="lg:col-span-2 space-y-8">
          {goal > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="size-4 text-primary" /> Fundraising goal
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {donorCount} {donorCount === 1 ? 'donor' : 'donors'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(Number(totalInDefault), defaultCurrency)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    of {formatCurrency(goal, defaultCurrency)}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {progress.toFixed(1)}% raised
                </p>
              </CardContent>
            </Card>
          )}

          {donationsEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" /> Make a donation
                </CardTitle>
                <CardDescription>
                  Fill in the form after sending your transfer. Your donation will appear publicly once confirmed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {bankDetails && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-sm text-foreground">
                        Payment details
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyBank}
                        className="h-7 -mt-1"
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                      {bankDetails}
                    </pre>
                  </div>
                )}

                {suggested.length > 0 && (
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Suggested amounts ({form.currency})
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {suggested.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={Number(form.amount) === amt ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setForm((f) => ({ ...f, amount: String(amt) }))}
                        >
                          {formatCurrency(amt, form.currency)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <form
                  className="grid sm:grid-cols-2 gap-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit.mutate()
                  }}
                >
                  <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={form.currency}
                        onValueChange={(v) => setForm({ ...form, currency: v })}
                      >
                        <SelectTrigger id="currency" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="donor_name">Your name *</Label>
                    <Input
                      id="donor_name"
                      required
                      maxLength={100}
                      value={form.donor_name}
                      onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="donor_email">Email (optional)</Label>
                    <Input
                      id="donor_email"
                      type="email"
                      maxLength={255}
                      value={form.donor_email}
                      onChange={(e) => setForm({ ...form, donor_email: e.target.value })}
                      placeholder="you@example.com"
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="payment_method">Payment method</Label>
                    <Select
                      value={form.payment_method}
                      onValueChange={(v) => setForm({ ...form, payment_method: v })}
                    >
                      <SelectTrigger id="payment_method" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        <SelectItem value="mobile_money">Mobile money</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="reference">Transfer reference (optional)</Label>
                    <Input
                      id="reference"
                      maxLength={120}
                      value={form.reference}
                      onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="e.g. transaction ID used when sending"
                      className="mt-1"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="message">Message (optional)</Label>
                    <Textarea
                      id="message"
                      maxLength={500}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="A short note for the community"
                      className="mt-1 min-h-[80px]"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2">
                    <Checkbox
                      id="anon"
                      checked={form.is_anonymous}
                      onCheckedChange={(v) =>
                        setForm({ ...form, is_anonymous: v === true })
                      }
                    />
                    <Label htmlFor="anon" className="cursor-pointer text-sm font-normal">
                      Show me as Anonymous on the public donor wall
                    </Label>
                  </div>

                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={submit.isPending}
                    >
                      {submit.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Heart className="size-4" />
                      )}
                      Submit my donation
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      AbiaConnect is non-profit. 100% of donations go to platform infrastructure
                      and community programs.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Donations are temporarily closed. Please check back soon.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Recent donors */}
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" /> Recent supporters
              </CardTitle>
              <CardDescription>Live updates from our community</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!recent || recent.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Be the first to contribute 💛
                </p>
              ) : (
                recent.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0"
                  >
                    <div className="size-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                      {d.donor_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {d.donor_name}
                        </p>
                        <span className="text-sm font-semibold text-primary whitespace-nowrap">
                          {formatCurrency(Number(d.amount), d.currency)}
                        </span>
                      </div>
                      {d.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          “{d.message}”
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  )
}
