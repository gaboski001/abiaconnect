import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AlertTriangle, Banknote, Bitcoin, Check, Copy, Heart, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { SEO } from '@/components/SEO'
import LegalRegistration from '@/components/LegalRegistration'
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel'
import { useThrottledCallback } from '@/hooks/useThrottledCallback'

type DonationAccount = {
  id: string
  account_type: 'bank' | 'crypto' | 'mobile_money'
  account_name: string
  account_number: string | null
  bank_name: string | null
  crypto_currency: string | null
  crypto_network: string | null
  wallet_address: string | null
  description: string | null
  order_index: number
}

const WHATSAPP_URL = 'https://wa.me/2348103428888'

const GROUP_META: Record<DonationAccount['account_type'], { title: string; icon: typeof Banknote }> = {
  bank: { title: '🏦 Bank Transfer', icon: Banknote },
  mobile_money: { title: '📱 Mobile Money', icon: Smartphone },
  crypto: { title: '₿ Cryptocurrency', icon: Bitcoin },
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          toast.success(`${label ?? 'Copied'}!`)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          toast.error('Could not copy')
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

function CryptoQR({ value }: { value: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current && value) {
      QRCode.toCanvas(ref.current, value, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }).catch(() => {})
    }
  }, [value])
  return <canvas ref={ref} className="rounded-md border border-border bg-white" aria-label="Wallet QR code" />
}

function AccountCard({ a }: { a: DonationAccount }) {
  if (a.account_type === 'crypto') {
    const addr = a.wallet_address ?? ''
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">
              ₿ {a.crypto_currency || a.account_name}
              {a.crypto_network && <span className="text-muted-foreground"> — {a.crypto_network}</span>}
            </h4>
            <Badge variant="secondary">Crypto</Badge>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {addr && <CryptoQR value={addr} />}
            <div className="flex-1 space-y-2 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet Address</p>
              <p className="font-mono text-sm break-all bg-muted/50 rounded-md p-2.5">{addr}</p>
              {addr && <CopyButton value={addr} label="Wallet copied" />}
            </div>
          </div>
          {a.description && <p className="text-sm text-muted-foreground border-t border-border pt-3">{a.description}</p>}
        </CardContent>
      </Card>
    )
  }

  const isMobile = a.account_type === 'mobile_money'
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">{isMobile ? '📱' : '🏦'} {a.bank_name || a.account_name}</h4>
          <Badge variant="secondary">{isMobile ? 'Mobile Money' : 'Bank'}</Badge>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {a.bank_name && (
            <div>
              <dt className="text-xs uppercase text-muted-foreground">{isMobile ? 'Provider' : 'Bank Name'}</dt>
              <dd className="font-medium">{a.bank_name}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Account Name</dt>
            <dd className="font-medium">{a.account_name}</dd>
          </div>
          {a.account_number && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-muted-foreground">{isMobile ? 'Phone / Account Number' : 'Account Number'}</dt>
              <dd className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-base font-semibold">{a.account_number}</span>
                <CopyButton value={a.account_number} label="Account number copied" />
              </dd>
            </div>
          )}
        </dl>
        {a.description && <p className="text-sm text-muted-foreground border-t border-border pt-3">{a.description}</p>}
      </CardContent>
    </Card>
  )
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.08.54 4.1 1.57 5.89L0 24l6.42-1.68a11.83 11.83 0 0 0 5.62 1.43h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.43ZM12.04 21.5h-.01a9.65 9.65 0 0 1-4.92-1.35l-.35-.21-3.81 1 1.02-3.71-.23-.38a9.66 9.66 0 1 1 17.93-5.01c0 5.33-4.34 9.66-9.63 9.66Zm5.55-7.23c-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.69.15-.2.3-.79.99-.97 1.19-.18.2-.36.22-.66.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.79-1.68-2.09-.18-.3-.02-.47.13-.62.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.69-1.66-.94-2.27-.25-.6-.5-.52-.69-.53l-.59-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.8-.74 2.05-1.45.25-.71.25-1.32.18-1.45-.07-.13-.27-.2-.57-.35Z" />
  </svg>
)

export default function Donate() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['donation_accounts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donation_accounts')
        .select('id,account_type,account_name,account_number,bank_name,crypto_currency,crypto_network,wallet_address,description,order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
      if (error) throw error
      return data as DonationAccount[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('donation_accounts_public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donation_accounts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['donation_accounts', 'active'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const grouped = useMemo(() => {
    const out: Record<DonationAccount['account_type'], DonationAccount[]> = { bank: [], mobile_money: [], crypto: [] }
    ;(data ?? []).forEach((a) => out[a.account_type]?.push(a))
    return out
  }, [data])

  const hasAny = (data?.length ?? 0) > 0

  return (
    <div className="min-h-screen">
      <SEO
        path="/donate"
        title="Support AbiaConnect — Donate to Keep Our Community Alive"
        description="AbiaConnect is a free, non-profit platform built by an Abian, for Abians everywhere. Your donation keeps the platform running and growing."
      />

      {/* Hero */}
      <section className="bg-[#1a4f3a] text-white">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:py-20 text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm">
            <Heart className="size-4" /> Support AbiaConnect
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Keep Our Community Alive</h1>
          <p className="mx-auto max-w-2xl text-white/85 text-base md:text-lg leading-relaxed">
            AbiaConnect is a free, non-profit community platform — built by an Abian, for Abians everywhere. Your donation
            keeps this platform running, growing, and free for every member.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-6 py-12 space-y-12">
        {/* Why */}
        <section className="grid md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-bold">Why Your Support Matters</h2>
            <p className="text-muted-foreground leading-relaxed">
              AbiaConnect was not built for profit. It was built for purpose.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This platform exists for every Abian — those who wake up to the sounds of home, and those who carry home
              only in their hearts. For the student striving to build a future. For the professional determined to give
              back. For the elder preserving what must not be forgotten. For the young person searching for identity,
              community, and belonging. For every Abian, wherever life has placed them, who still feels the pull of
              where they come from.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We built AbiaConnect because our people deserve a space that is entirely their own — a platform where
              Abian voices are heard, Abian stories are told, and Abian connections are made and strengthened across
              every distance.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This platform runs on dedication, community love — and the generous support of members like you. There are
              no shareholders here. No hidden agenda. No gatekeepers. Just a community platform —
              conceived by an Abian, built for Abians, and sustained by Abians.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              When you donate to AbiaConnect, you are not paying for a service. You are investing in your people. You
              are saying that this community matters, that these connections matter, and that every Abian — regardless
              of where they are in the world — deserves a home online that reflects who we are and what we stand for.
            </p>
            <p className="font-medium">Your support keeps that home standing.</p>
          </div>
          <div className="grid gap-3">
            {[
              { e: '🖥', t: 'Server & Hosting Costs', d: 'Keeping AbiaConnect fast, available, and online 24/7 for members across the globe.' },
              { e: '🔒', t: 'Security & Maintenance', d: 'Protecting member data and keeping the platform safe, updated, and bug-free.' },
              { e: '⚡', t: 'New Features & Growth', d: 'Building new tools, subgroups, and community features that make AbiaConnect more powerful.' },
              { e: '🌍', t: 'Community Expansion', d: 'Reaching more Abians at home and in the diaspora and bringing them into the community.' },
            ].map((f) => (
              <Card key={f.t}>
                <CardContent className="p-4 flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>{f.e}</span>
                  <div>
                    <h3 className="font-semibold">{f.t}</h3>
                    <p className="text-sm text-muted-foreground">{f.d}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Anti-scam notice */}
        <section
          className="rounded-xl border-2 p-5 md:p-6 flex gap-4"
          style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b', color: '#451a03' }}
        >
          <AlertTriangle className="size-6 shrink-0 mt-0.5" style={{ color: '#b45309' }} />
          <div className="space-y-2 text-sm md:text-[15px] leading-relaxed">
            <p className="font-bold text-base">⚠️ IMPORTANT — Please Read Before Donating</p>
            <p>For your safety, only the account details displayed on this page are authorised to receive donations on behalf of AbiaConnect.</p>
            <p><strong>AbiaConnect will NEVER contact you privately</strong> to request donations or ask you to send money to any personal account.</p>
            <p>If anyone contacts you claiming to collect donations on behalf of AbiaConnect outside of this page — please report it immediately. It is a scam.</p>
            <p>When in doubt, verify directly with the Project Manager via the official WhatsApp contact below.</p>
          </div>
        </section>

        <LegalRegistration
          leadIn="Your donation goes to a legitimate, officially registered platform. AbiaConnect is fully registered under Nigerian law — transparent, accountable, and committed to this community."
          footnote="Registration details can be independently verified through the Corporate Affairs Commission (CAC) of Nigeria using RC Number 3386638."
        />

        {/* Accounts */}
        <section className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold">Authorised Donation Channels</h2>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : !hasAny ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Donation accounts are being updated. Please check back shortly or contact us via WhatsApp.
              </CardContent>
            </Card>
          ) : (
            (Object.keys(GROUP_META) as Array<DonationAccount['account_type']>).map((type) => {
              const items = grouped[type]
              if (!items.length) return null
              return (
                <div key={type} className="space-y-3">
                  <h3 className="text-lg font-semibold">{GROUP_META[type].title}</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {items.map((a) => <AccountCard key={a.id} a={a} />)}
                  </div>
                </div>
              )
            })
          )}
        </section>

        {/* WhatsApp */}
        <section className="rounded-xl border border-border bg-card p-6 md:p-8 text-center space-y-4">
          <h2 className="text-xl md:text-2xl font-bold">💬 Have a question about your donation?</h2>
          <p className="text-muted-foreground">
            Reach the Project Manager directly via WhatsApp — the ONLY authorised channel for donation enquiries.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#25D366' }}
          >
            <WhatsAppIcon className="size-5" /> Chat on WhatsApp
          </a>
          <p className="text-sm text-muted-foreground">08103428888 — Official AbiaConnect Project Manager</p>
          <p className="text-xs text-muted-foreground">
            This is the only authorised WhatsApp contact for AbiaConnect. Do not send donations to any other number.
          </p>
        </section>

        {/* Thank you */}
        <section className="rounded-xl bg-primary/5 border border-border p-6 md:p-8 space-y-3">
          <h2 className="text-2xl font-bold">Thank You for Believing in This Community.</h2>
          <p className="text-muted-foreground leading-relaxed">
            Every contribution — whether it's ₦500 or $500 — is a vote of confidence in what we are building together. On
            behalf of every Abian this platform serves, we are deeply grateful.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Your name may not be on the building — but your support is in every thread, every connection, and every
            conversation this platform makes possible.
          </p>
          <p className="font-semibold">— Okechukwu Gabriel E., Founder &amp; CEO, AbiaConnect</p>
        </section>
      </div>
    </div>
  )
}
