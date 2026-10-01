import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CheckCircle2, Copy, Pencil, Plus, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatMoney } from '@/lib/monetization/strings'
import type { Plan, PlanLimits } from '@/lib/monetization/api'
import { toast } from '@/lib/toast'

// Monetization tables are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message) || 'Something went wrong'

export default function DatingMonetizationSection() {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-bold">Dating Monetization</h2>
        <p className="text-sm text-muted-foreground">
          Plans, limits and payment providers are configured here; nothing is hard-coded. All changes are audited.
        </p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Payment providers</TabsTrigger>
          <TabsTrigger value="plans">Plans & limits</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="logs">Provider logs</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </section>
  )
}

// ---------------------------------------------------------------------------
function OverviewTab() {
  const q = useQuery({
    queryKey: ['admin-monetization-summary'],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_monetization_summary')
      if (error) throw error
      return data as {
        revenue: Record<string, { today: number; last_7_days: number; last_30_days: number; total: number }>
        active_subscribers: number
        paying_users: number
        payments_by_status: Record<string, number>
        funnel_30d: Record<string, number>
      }
    },
  })
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.error) return <p className="text-sm text-destructive">{errMsg(q.error)}</p>
  const s = q.data!
  const funnel = [
    'DISCOVERY_VIEWED',
    'LIKE_SENT',
    'MATCH_CREATED',
    'LIKE_LIMIT_REACHED',
    'PAYWALL_VIEWED',
    'PREMIUM_PAGE_VIEWED',
    'PRODUCT_SELECTED',
    'CHECKOUT_STARTED',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
  ]
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active subscribers" value={s.active_subscribers} />
        <Stat label="Paying users (all time)" value={s.paying_users} />
        <Stat label="Successful payments" value={s.payments_by_status.success ?? 0} />
        <Stat label="Pending payments" value={s.payments_by_status.pending ?? 0} />
      </div>
      {Object.keys(s.revenue).length === 0 ? (
        <p className="text-sm text-muted-foreground">No revenue yet.</p>
      ) : (
        Object.entries(s.revenue).map(([currency, r]) => (
          <div key={currency}>
            <p className="mb-2 text-sm font-semibold">Revenue ({currency})</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Today" value={formatMoney(r.today, currency)} />
              <Stat label="Last 7 days" value={formatMoney(r.last_7_days, currency)} />
              <Stat label="Last 30 days" value={formatMoney(r.last_30_days, currency)} />
              <Stat label="Total" value={formatMoney(r.total, currency)} />
            </div>
          </div>
        ))
      )}
      <div>
        <p className="mb-2 text-sm font-semibold">Funnel — unique users, last 30 days</p>
        <ul className="divide-y rounded-xl border text-sm">
          {funnel.map((e) => (
            <li key={e} className="flex justify-between px-3 py-2">
              <span className="font-mono text-xs">{e}</span>
              <span className="font-semibold">{s.funnel_30d[e] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
interface ProviderRow {
  provider: 'paystack' | 'monnify' | 'squad'
  display_name: string
  is_enabled: boolean
  mode: 'test' | 'live'
  contract_code: string | null
}

interface ProviderStatus {
  provider: string
  configured: { test: boolean; live: boolean }
  secretNames: { test: string[]; live: string[] }
  webhookUrl: string
}

interface SecretPreview {
  name: string
  preview: string
  updated_at: string
}

/** Friendly label + the prefix each provider's keys normally start with. */
const SECRET_INFO: Record<string, { label: string; hint: string; prefix?: RegExp }> = {
  PAYSTACK_TEST_SECRET_KEY: { label: 'Secret key', hint: 'Starts with sk_test_', prefix: /^sk_test_/ },
  PAYSTACK_LIVE_SECRET_KEY: { label: 'Secret key', hint: 'Starts with sk_live_', prefix: /^sk_live_/ },
  MONNIFY_TEST_API_KEY: { label: 'API key', hint: 'Usually starts with MK_TEST_', prefix: /^MK_TEST_/i },
  MONNIFY_TEST_SECRET_KEY: { label: 'Secret key', hint: 'From Developer → API Keys (test)' },
  MONNIFY_LIVE_API_KEY: { label: 'API key', hint: 'Usually starts with MK_PROD_', prefix: /^MK_PROD_/i },
  MONNIFY_LIVE_SECRET_KEY: { label: 'Secret key', hint: 'From Developer → API Keys (live)' },
  SQUAD_TEST_SECRET_KEY: { label: 'Secret key', hint: 'Sandbox key, usually starts with sandbox_sk_', prefix: /^sandbox_sk_/ },
  SQUAD_LIVE_SECRET_KEY: { label: 'Secret key', hint: 'Live secret key from your Squad dashboard' },
}

function ProvidersTab() {
  const qc = useQueryClient()
  const rows = useQuery({
    queryKey: ['admin-payment-providers'],
    queryFn: async () => {
      const { data, error } = await db.from('payment_providers').select('*').order('sort_order')
      if (error) throw error
      return data as ProviderRow[]
    },
  })
  const status = useQuery({
    queryKey: ['admin-payment-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('payments-admin-status')
      if (error) throw error
      return data as { providers: ProviderStatus[]; siteUrlConfigured: boolean }
    },
  })
  const previews = useQuery({
    queryKey: ['admin-payment-secret-previews'],
    queryFn: async () => {
      const { data, error } = await db.from('payment_secret_settings').select('name, preview, updated_at')
      if (error) throw error
      return new Map((data as SecretPreview[]).map((r) => [r.name, r]))
    },
  })
  const save = useMutation({
    mutationFn: async (row: Partial<ProviderRow> & { provider: string }) => {
      const { provider, ...patch } = row
      const { error } = await db.from('payment_providers').update(patch).eq('provider', provider)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Saved')
      qc.invalidateQueries({ queryKey: ['admin-payment-providers'] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })
  const refreshSecrets = () => {
    qc.invalidateQueries({ queryKey: ['admin-payment-secret-previews'] })
    qc.invalidateQueries({ queryKey: ['admin-payment-status'] })
    qc.invalidateQueries({ queryKey: ['admin-payment-providers'] })
  }

  if (rows.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (rows.error) return <p className="text-sm text-destructive">{errMsg(rows.error)}</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Switch on any provider. If more than one is on, members choose at checkout. API keys are encrypted in the
        database vault: once saved they are shown masked (e.g. <code>sk_test_xxxxxxxxxx</code>) and can be replaced or
        removed, but never viewed again.
      </p>
      {status.data && !status.data.siteUrlConfigured && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm">
          Optional: set the <code>PUBLIC_SITE_URL</code> secret (defaults to https://abiaconnect.com) for payment return links.
        </p>
      )}
      {rows.data!.map((p) => {
        const st = status.data?.providers.find((s) => s.provider === p.provider)
        const names = st?.secretNames ?? defaultSecretNames(p.provider)
        const savedAll = (m: 'test' | 'live') => names[m].every((n) => previews.data?.has(n))
        const ready = (m: 'test' | 'live') => savedAll(m) || (st?.configured[m] ?? false)
        return (
          <div key={p.provider} className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{p.display_name}</p>
                {p.is_enabled ? <Badge>On</Badge> : <Badge variant="secondary">Off</Badge>}
                <Badge variant="outline">{p.mode === 'live' ? 'Live' : 'Test'}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`en-${p.provider}`} className="text-sm">Enabled</Label>
                <Switch
                  id={`en-${p.provider}`}
                  checked={p.is_enabled}
                  onCheckedChange={(v) => {
                    if (v && !ready(p.mode)) {
                      toast.error(`Save the ${p.mode} keys for ${p.display_name} first.`)
                      return
                    }
                    if (v && p.provider === 'monnify' && !p.contract_code) {
                      toast.error('Enter the Monnify contract code first.')
                      return
                    }
                    save.mutate({ provider: p.provider, is_enabled: v })
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Mode</Label>
                <Select
                  value={p.mode}
                  onValueChange={(v) => {
                    const mode = v as 'test' | 'live'
                    if (p.is_enabled && !ready(mode)) {
                      toast.error(`Save the ${mode} keys first, or switch ${p.display_name} off.`)
                      return
                    }
                    save.mutate({ provider: p.provider, mode })
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test (sandbox)</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {p.provider === 'monnify' && (
                <ContractCode value={p.contract_code ?? ''} onSave={(v) => save.mutate({ provider: p.provider, contract_code: v || null })} />
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {(['test', 'live'] as const).map((m) => (
                <fieldset key={m} className="space-y-3 rounded-lg border p-3">
                  <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
                    {ready(m) ? (
                      <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    {m === 'test' ? 'Test keys' : 'Live keys'}
                  </legend>
                  {names[m].map((n) => (
                    <SecretField key={n} name={n} saved={previews.data?.get(n)} onChanged={refreshSecrets} />
                  ))}
                </fieldset>
              ))}
            </div>

            {st && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Webhook URL:</span>
                <code className="truncate rounded bg-muted px-1">{st.webhookUrl}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  aria-label="Copy webhook URL"
                  onClick={() => navigator.clipboard.writeText(st.webhookUrl).then(() => toast.success('Copied'))}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function defaultSecretNames(provider: ProviderRow['provider']) {
  const P = provider.toUpperCase()
  return provider === 'monnify'
    ? { test: [`${P}_TEST_API_KEY`, `${P}_TEST_SECRET_KEY`], live: [`${P}_LIVE_API_KEY`, `${P}_LIVE_SECRET_KEY`] }
    : { test: [`${P}_TEST_SECRET_KEY`], live: [`${P}_LIVE_SECRET_KEY`] }
}

/**
 * One API key. Once saved, only the masked preview is ever shown; the value
 * itself never comes back from the server.
 */
export function SecretField({ name, saved, onChanged }: { name: string; saved?: SecretPreview; onChanged: () => void }) {
  const info = SECRET_INFO[name] ?? { label: name, hint: '' }
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const id = `secret-${name}`

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc('admin_set_payment_secret', { _name: name, _value: value.trim() })
      if (error) throw error
      return data as string
    },
    onSuccess: (preview) => {
      setValue('')
      setEditing(false)
      toast.success(`Saved as ${preview}`)
      onChanged()
    },
    onError: (e) => toast.error(errMsg(e)),
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc('admin_clear_payment_secret', { _name: name })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Key removed')
      onChanged()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const prefixWarning = value.trim() && info.prefix && !info.prefix.test(value.trim())

  if (saved && !editing) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{info.label}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted px-2 py-1.5 text-sm" aria-label={`${info.label} (hidden)`}>
            {saved.preview}
          </code>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Replace</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600"
            disabled={remove.isPending}
            onClick={() => window.confirm(`Remove the saved ${info.label.toLowerCase()}? The provider will be switched off in this mode.`) && remove.mutate()}
          >
            Remove
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Saved {format(new Date(saved.updated_at), 'dd MMM yyyy HH:mm')}</p>
      </div>
    )
  }

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) save.mutate()
      }}
    >
      <Label htmlFor={id} className="text-xs">{info.label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={info.hint}
        />
        <Button type="submit" disabled={!value.trim() || save.isPending}>Save</Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={() => { setEditing(false); setValue('') }}>
            Cancel
          </Button>
        )}
      </div>
      {prefixWarning ? (
        <p className="text-[11px] text-amber-600">This doesn't look like the usual format ({info.hint}). Double-check before saving.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">{info.hint}</p>
      )}
    </form>
  )
}

function ContractCode({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <div>
      <Label className="text-xs">Contract code</Label>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value.trim())} placeholder="From your Monnify dashboard" />
        <Button variant="outline" onClick={() => onSave(v)} disabled={v === value}>Save</Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
type PlanDraft = Omit<Plan, 'id'> & { id?: string }

const EMPTY_PLAN: PlanDraft = {
  code: '',
  name: '',
  description: '',
  tier: 'premium',
  price_minor: 0,
  promo_price_minor: null,
  currency: 'NGN',
  billing_period: 'month',
  duration_days: 30,
  features: [],
  limits: { daily_likes: null, see_likes: true, likes_you_preview: 0, advanced_filters: true, premium_badge: true, remove_ads: true },
  is_active: false,
  is_visible: true,
  is_recommended: false,
  sort_order: 30,
}

function PlansTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<PlanDraft | null>(null)
  const q = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data, error } = await db.from('subscription_plans').select('*').order('sort_order')
      if (error) throw error
      return data as Plan[]
    },
  })
  const save = useMutation({
    mutationFn: async (p: PlanDraft) => {
      const { id, ...row } = p
      const { error } = id
        ? await db.from('subscription_plans').update(row).eq('id', id)
        : await db.from('subscription_plans').insert(row)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Plan saved')
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
      qc.invalidateQueries({ queryKey: ['dating-plans'] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.error) return <p className="text-sm text-destructive">{errMsg(q.error)}</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          New paid plans start inactive. Review the price, then switch "Active" on to sell it.
        </p>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY_PLAN })}>
          <Plus className="size-4" /> New plan
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs">
            <tr>
              <th className="p-2">Plan</th>
              <th className="p-2">Price</th>
              <th className="p-2">Period</th>
              <th className="p-2">Daily likes</th>
              <th className="p-2">See likes</th>
              <th className="p-2">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {q.data!.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">
                  <p className="font-medium">{p.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                </td>
                <td className="p-2">
                  {p.tier === 'free' ? 'Free' : formatMoney(p.promo_price_minor ?? p.price_minor, p.currency)}
                  {p.promo_price_minor != null && (
                    <span className="ml-1 text-xs text-muted-foreground line-through">{formatMoney(p.price_minor, p.currency)}</span>
                  )}
                </td>
                <td className="p-2">{p.duration_days} days</td>
                <td className="p-2">{p.limits.daily_likes == null ? 'Unlimited' : p.limits.daily_likes}</td>
                <td className="p-2">{p.limits.see_likes ? 'Yes' : 'No'}</td>
                <td className="p-2">
                  {p.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  {!p.is_visible && <Badge variant="outline" className="ml-1">Hidden</Badge>}
                </td>
                <td className="p-2 text-right">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing({ ...p })}>
                    <Pencil className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <PlanEditor
          plan={editing}
          saving={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(p) => save.mutate(p)}
        />
      )}
    </div>
  )
}

function PlanEditor({
  plan,
  saving,
  onCancel,
  onSave,
}: {
  plan: PlanDraft
  saving: boolean
  onCancel: () => void
  onSave: (p: PlanDraft) => void
}) {
  const [p, setP] = useState<PlanDraft>(plan)
  const isFree = p.code === 'free'
  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) => setP((x) => ({ ...x, [k]: v }))
  const setLimit = <K extends keyof PlanLimits>(k: K, v: PlanLimits[K]) => setP((x) => ({ ...x, limits: { ...x.limits, [k]: v } }))
  const toMinor = (v: string) => Math.round(Number(v || 0) * 100)

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p.id ? `Edit ${p.name}` : 'New plan'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code (letters, numbers, _)">
            <Input value={p.code} disabled={!!p.id} onChange={(e) => set('code', e.target.value.toLowerCase())} />
          </Field>
          <Field label="Name">
            <Input value={p.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Input value={p.description ?? ''} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
          {!isFree && (
            <>
              <Field label="Tier">
                <Select value={p.tier} onValueChange={(v) => set('tier', v as Plan['tier'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={p.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Price (e.g. 4999.00)">
                <Input type="number" min="0" step="0.01" defaultValue={(p.price_minor / 100).toString()} onChange={(e) => set('price_minor', toMinor(e.target.value))} />
              </Field>
              <Field label="Promo price (blank = none)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={p.promo_price_minor != null ? (p.promo_price_minor / 100).toString() : ''}
                  onChange={(e) => set('promo_price_minor', e.target.value === '' ? null : toMinor(e.target.value))}
                />
              </Field>
              <Field label="Billing period">
                <Select
                  value={p.billing_period}
                  onValueChange={(v) => {
                    set('billing_period', v as Plan['billing_period'])
                    set('duration_days', v === 'year' ? 365 : 30)
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Access length (days)">
                <Input type="number" min="1" max="3660" value={p.duration_days} onChange={(e) => set('duration_days', Number(e.target.value))} />
              </Field>
            </>
          )}
          <div className="sm:col-span-2">
            <Field label="Features shown to members (one per line)">
              <Textarea
                rows={4}
                value={(p.features ?? []).join('\n')}
                onChange={(e) => set('features', e.target.value.split('\n').map((f) => f.trim()).filter(Boolean))}
              />
            </Field>
          </div>
          <p className="sm:col-span-2 pt-2 text-sm font-semibold">Limits & entitlements</p>
          <Field label="Daily likes (blank = unlimited)">
            <Input
              type="number"
              min="0"
              value={p.limits.daily_likes ?? ''}
              onChange={(e) => setLimit('daily_likes', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="'Likes You' preview count (free)">
            <Input type="number" min="0" value={p.limits.likes_you_preview ?? 0} onChange={(e) => setLimit('likes_you_preview', Number(e.target.value))} />
          </Field>
          <Toggle label="See who liked you" checked={!!p.limits.see_likes} onChange={(v) => setLimit('see_likes', v)} />
          <Toggle label="Advanced filters" checked={!!p.limits.advanced_filters} onChange={(v) => setLimit('advanced_filters', v)} />
          <Toggle label="Premium badge" checked={!!p.limits.premium_badge} onChange={(v) => setLimit('premium_badge', v)} />
          <Toggle label="Ad-free" checked={!!p.limits.remove_ads} onChange={(v) => setLimit('remove_ads', v)} />
          <p className="sm:col-span-2 pt-2 text-sm font-semibold">Visibility</p>
          {!isFree && <Toggle label="Active (can be bought)" checked={p.is_active} onChange={(v) => set('is_active', v)} />}
          <Toggle label="Visible on pricing page" checked={p.is_visible} onChange={(v) => set('is_visible', v)} />
          {!isFree && <Toggle label="Recommended" checked={p.is_recommended} onChange={(v) => set('is_recommended', v)} />}
          <Field label="Sort order">
            <Input type="number" value={p.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => {
              if (!/^[a-z0-9_]{2,40}$/.test(p.code)) return toast.error('Code must be 2–40 lowercase letters, numbers or _')
              if (!p.name.trim()) return toast.error('Name is required')
              if (!isFree && p.is_active && (p.promo_price_minor ?? p.price_minor) <= 0)
                return toast.error('An active paid plan needs a price above zero')
              onSave(p)
            }}
            disabled={saving}
          >
            Save plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `t-${label.replace(/\W+/g, '-')}`
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
interface TransactionRow {
  reference: string
  provider: string
  provider_reference: string | null
  amount_minor: number
  currency: string
  status: string
  mode: 'test' | 'live'
  failure_reason: string | null
  created_at: string
  user_id: string
  plan: { name: string } | null
}

function TransactionsTab() {
  const [status, setStatus] = useState('all')
  const [provider, setProvider] = useState('all')
  const q = useQuery({
    queryKey: ['admin-transactions', status, provider],
    queryFn: async () => {
      let query = db
        .from('payment_transactions')
        .select('reference, provider, provider_reference, amount_minor, currency, status, mode, failure_reason, created_at, user_id, plan:subscription_plans(name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (status !== 'all') query = query.eq('status', status)
      if (provider !== 'all') query = query.eq('provider', provider)
      const { data, error } = await query
      if (error) throw error
      return data as TransactionRow[]
    },
  })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterSelect value={provider} onChange={setProvider} options={['all', 'paystack', 'monnify', 'squad']} />
        <FilterSelect value={status} onChange={setStatus} options={['all', 'pending', 'success', 'failed', 'abandoned', 'refunded', 'amount_mismatch']} />
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{errMsg(q.error)}</p>
      ) : !q.data!.length ? (
        <p className="text-sm text-muted-foreground">No transactions.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs">
              <tr>
                <th className="p-2">Date</th>
                <th className="p-2">Reference</th>
                <th className="p-2">Provider</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {q.data!.map((t) => (
                <tr key={t.reference} className="border-t">
                  <td className="whitespace-nowrap p-2">{format(new Date(t.created_at), 'dd MMM yyyy HH:mm')}</td>
                  <td className="p-2 font-mono text-xs">{t.reference}</td>
                  <td className="p-2">
                    {t.provider} {t.mode === 'test' && <Badge variant="outline">test</Badge>}
                  </td>
                  <td className="p-2">{t.plan?.name ?? '—'}</td>
                  <td className="p-2">{formatMoney(Number(t.amount_minor), t.currency)}</td>
                  <td className="p-2">
                    <Badge variant={t.status === 'success' ? 'default' : 'secondary'}>{t.status}</Badge>
                    {t.failure_reason && <p className="text-xs text-muted-foreground">{t.failure_reason}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o === 'all' ? 'All' : o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---------------------------------------------------------------------------
interface LogRow {
  id: number
  action: string
  reference: string | null
  http_status: number | null
  ok: boolean
  duration_ms: number | null
  request: unknown
  response: unknown
  error: string | null
  created_at: string
}

function LogsTab() {
  const [provider, setProvider] = useState('paystack')
  const [okFilter, setOkFilter] = useState('all')
  const [open, setOpen] = useState<number | null>(null)
  const q = useQuery({
    queryKey: ['admin-provider-logs', provider, okFilter],
    queryFn: async () => {
      let query = db.from('payment_provider_logs').select('*').eq('provider', provider).order('created_at', { ascending: false }).limit(100)
      if (okFilter !== 'all') query = query.eq('ok', okFilter === 'ok')
      const { data, error } = await query
      if (error) throw error
      return data as LogRow[]
    },
  })
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterSelect value={provider} onChange={setProvider} options={['paystack', 'monnify', 'squad']} />
        <FilterSelect value={okFilter} onChange={setOkFilter} options={['all', 'ok', 'error']} />
        <Button variant="outline" onClick={() => q.refetch()}>Refresh</Button>
      </div>
      <p className="text-xs text-muted-foreground">Keys, tokens and card/bank details are removed before logging.</p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">{errMsg(q.error)}</p>
      ) : !q.data!.length ? (
        <p className="text-sm text-muted-foreground">No log entries for {provider}.</p>
      ) : (
        <ul className="divide-y rounded-xl border text-sm">
          {q.data!.map((l) => (
            <li key={l.id} className="p-2">
              <button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(open === l.id ? null : l.id)}>
                {l.ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-rose-600" />}
                <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd MMM HH:mm:ss')}</span>
                <Badge variant="outline">{l.action}</Badge>
                {l.http_status && <span className="text-xs">HTTP {l.http_status}</span>}
                {l.duration_ms != null && <span className="text-xs text-muted-foreground">{l.duration_ms} ms</span>}
                {l.reference && <span className="font-mono text-xs">{l.reference}</span>}
                {l.error && <span className="text-xs text-rose-600">{l.error}</span>}
              </button>
              {open === l.id && (
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-muted p-2 text-xs">
                  {JSON.stringify({ request: l.request, response: l.response }, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
interface SubscriptionRow {
  id: string
  user_id: string
  status: string
  source: 'payment' | 'admin_grant'
  starts_at: string
  ends_at: string
  note: string | null
  plan: { name: string } | null
  email?: string
}

function SubscriptionsTab() {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [planCode, setPlanCode] = useState('premium_monthly')
  const [days, setDays] = useState(7)
  const [note, setNote] = useState('')

  const plans = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const { data, error } = await db.from('subscription_plans').select('*').order('sort_order')
      if (error) throw error
      return data as Plan[]
    },
  })
  const subs = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await db
        .from('user_subscriptions')
        .select('id, user_id, status, source, starts_at, ends_at, note, plan:subscription_plans(name)')
        .eq('status', 'active')
        .gt('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: false })
        .limit(100)
      if (error) throw error
      const ids = [...new Set((data as Array<{ user_id: string }>).map((s) => s.user_id))]
      const { data: emails } = ids.length ? await db.rpc('admin_get_user_emails', { _ids: ids }) : { data: [] }
      const map = new Map<string, string>((emails ?? []).map((e: { id: string; email: string }) => [e.id, e.email]))
      return (data as SubscriptionRow[]).map((s) => ({ ...s, email: map.get(s.user_id) }))
    },
  })

  const grant = useMutation({
    mutationFn: async () => {
      const { data: found, error } = await db.rpc('admin_search_user_ids_by_email', { _term: email.trim() })
      if (error) throw error
      if (!found?.length) throw new Error('No user with that email')
      if (found.length > 1) throw new Error('More than one user matches; enter the full email')
      const { error: gErr } = await db.rpc('admin_grant_subscription', {
        _user: found[0].id,
        _plan_code: planCode,
        _days: days,
        _note: note || null,
      })
      if (gErr) throw gErr
    },
    onSuccess: () => {
      toast.success('Premium granted')
      setEmail('')
      setNote('')
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc('admin_revoke_subscription', { _subscription_id: id, _note: 'Revoked by admin' })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Revoked')
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border p-4">
        <p className="font-semibold">Grant premium days</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label className="text-xs">Member email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
          </div>
          <div>
            <Label className="text-xs">Plan</Label>
            <Select value={planCode} onValueChange={setPlanCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(plans.data ?? []).filter((p) => p.tier !== 'free').map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Days</Label>
            <Input type="number" min="1" max="3660" value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </div>
          <div className="sm:col-span-4">
            <Label className="text-xs">Reason (saved in the audit log)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Support compensation" />
          </div>
        </div>
        <Button onClick={() => grant.mutate()} disabled={!email.trim() || grant.isPending}>Grant</Button>
      </div>

      <div>
        <p className="mb-2 font-semibold">Active subscriptions</p>
        {subs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !subs.data?.length ? (
          <p className="text-sm text-muted-foreground">No active subscriptions.</p>
        ) : (
          <ul className="divide-y rounded-xl border text-sm">
            {subs.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{s.email ?? s.user_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.plan?.name} · {s.source === 'admin_grant' ? 'Granted' : 'Paid'} · until {format(new Date(s.ends_at), 'dd MMM yyyy')}
                    {s.note ? ` · ${s.note}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.confirm('Revoke this subscription now?') && revoke.mutate(s.id)}
                  disabled={revoke.isPending}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
interface AuditRow {
  id: number
  actor_id: string | null
  action: string
  target: string | null
  created_at: string
}

function AuditTab() {
  const q = useQuery({
    queryKey: ['admin-monetization-audit'],
    queryFn: async () => {
      const { data, error } = await db.from('monetization_audit_log').select('*').order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return data as AuditRow[]
    },
  })
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.error) return <p className="text-sm text-destructive">{errMsg(q.error)}</p>
  if (!q.data!.length) return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
  return (
    <ul className="divide-y rounded-xl border text-sm">
      {q.data!.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 p-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd MMM yyyy HH:mm')}</span>
          <Badge variant="outline">{a.action}</Badge>
          {a.target && <span className="font-mono text-xs">{a.target}</span>}
          <span className="text-xs text-muted-foreground">by {a.actor_id ? String(a.actor_id).slice(0, 8) : 'system'}</span>
        </li>
      ))}
    </ul>
  )
}
