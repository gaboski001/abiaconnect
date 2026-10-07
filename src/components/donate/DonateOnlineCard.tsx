import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, Heart, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { getPaymentOptions } from '@/lib/monetization/api'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export const DONATION_PRESETS = [1000, 5000, 10000, 50000]
export const DONATION_REFERENCE_KEY = 'abia:pending-donation-reference'

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

/** The server's reason for a refused request. */
async function functionErrorMessage(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
    } catch {
      /* not JSON */
    }
  }
  return 'Could not start the donation. Please try again.'
}

/**
 * Donate online through the payment gateway (Paystack / Monnify / Squad,
 * whichever an admin has switched on). The donation is confirmed only after
 * the provider's payment is verified on the server.
 */
export function DonateOnlineCard() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const options = useQuery({ queryKey: ['payment-options'], queryFn: getPaymentOptions })

  const [preset, setPreset] = useState<number | null>(5000)
  const [custom, setCustom] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  // Prefill for signed-in members.
  useEffect(() => {
    const profileName = profile?.display_name || profile?.username
    if (!name && profileName) setName(profileName)
    if (!email && user?.email) setEmail(user.email)
  }, [profile, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const amount = preset ?? Number(custom.replace(/[^\d.]/g, ''))
  const providers = options.data ?? []

  if (options.isLoading) return null
  if (!providers.length) return null // no gateway switched on: bank/crypto details below still work

  const pay = async (provider: string) => {
    if (!Number.isFinite(amount) || amount < 100) return toast.error('Please enter at least ₦100.')
    if (amount > 10_000_000) return toast.error('The most you can give in one go is ₦10,000,000.')
    if (name.trim().length < 2) return toast.error('Please enter your name.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error('Please enter a valid email for your receipt.')
    setBusy(provider)
    const { data, error } = await supabase.functions.invoke('donations-checkout', {
      body: { amount, provider, name: name.trim(), email: email.trim(), message: message.trim() || undefined, anonymous },
    })
    if (error || !data?.checkoutUrl) {
      setBusy(null)
      return toast.error(error ? await functionErrorMessage(error) : 'Could not start the donation.')
    }
    try {
      sessionStorage.setItem(DONATION_REFERENCE_KEY, String(data.reference))
    } catch {
      /* private mode */
    }
    window.location.href = data.checkoutUrl
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-6 md:p-8 shadow-sm space-y-6" aria-label="Donate online">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden>
          <Heart className="size-5" />
        </span>
        <div>
          <h2 className="text-2xl font-bold">Donate online</h2>
          <p className="text-sm text-muted-foreground">
            Pay securely by card, bank transfer or USSD. Your donation is confirmed automatically.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Choose an amount</Label>
        <div className="flex flex-wrap gap-2">
          {DONATION_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPreset(p)
                setCustom('')
              }}
              aria-pressed={preset === p}
              className={cn(
                'rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
                preset === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
              )}
            >
              {naira(p)}
            </button>
          ))}
          <Input
            inputMode="numeric"
            aria-label="Other amount in Naira"
            placeholder="Other amount (₦)"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              setPreset(null)
            }}
            className="h-11 w-44"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="donor-name">Your name</Label>
          <Input id="donor-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="donor-email">Email (for your receipt)</Label>
          <Input id="donor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="donor-message">Message (optional)</Label>
          <Textarea id="donor-message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Switch checked={anonymous} onCheckedChange={setAnonymous} />
          Give anonymously (we'll keep your name private)
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          {providers.map((p) => (
            <Button key={p.provider} size="lg" onClick={() => pay(p.provider)} disabled={!!busy}>
              {busy === p.provider ? <Loader2 className="animate-spin" /> : <CreditCard />}
              {providers.length > 1 ? `Donate ${Number.isFinite(amount) && amount > 0 ? naira(amount) : ''} with ${p.display_name}` : `Donate ${Number.isFinite(amount) && amount > 0 ? naira(amount) : ''}`}
            </Button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Payments are processed by our licensed payment partner. We never see your card
          details.
        </p>
      </div>
    </section>
  )
}
