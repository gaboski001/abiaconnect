import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Search,
  Settings as SettingsIcon,
  Trash2,
  XCircle,
  Heart,
  Save,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'

interface Donation {
  id: string
  donor_name: string
  donor_email: string | null
  amount: number
  currency: string
  message: string | null
  is_anonymous: boolean
  payment_method: string
  reference: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  admin_notes: string | null
  confirmed_at: string | null
  created_at: string
}

const STATUS_COLOR: Record<Donation['status'], string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
}

function toCSV(rows: Donation[]) {
  const headers = [
    'id',
    'created_at',
    'status',
    'donor_name',
    'donor_email',
    'amount',
    'currency',
    'payment_method',
    'reference',
    'is_anonymous',
    'message',
  ]
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => esc((r as unknown as Record<string, unknown>)[h])).join(','),
    ),
  ].join('\n')
}

export default function AdminDonations() {
  const qc = useQueryClient()
  const { settings, updateSetting } = useSiteSettings()
  const [statusFilter, setStatusFilter] = useState<'all' | Donation['status']>('all')
  const [search, setSearch] = useState('')

  const { data: donations, isLoading } = useQuery({
    queryKey: ['admin-donations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as Donation[]
    },
    refetchInterval: 15_000,
  })

  const filtered = useMemo(() => {
    if (!donations) return []
    return donations.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        d.donor_name?.toLowerCase().includes(q) ||
        d.donor_email?.toLowerCase().includes(q) ||
        d.reference?.toLowerCase().includes(q)
      )
    })
  }, [donations, statusFilter, search])

  const stats = useMemo(() => {
    const list = donations ?? []
    const confirmed = list.filter((d) => d.status === 'confirmed')
    const pending = list.filter((d) => d.status === 'pending')
    const byCurrency: Record<string, number> = {}
    for (const d of confirmed) {
      byCurrency[d.currency] = (byCurrency[d.currency] || 0) + Number(d.amount)
    }
    return {
      pending: pending.length,
      confirmed: confirmed.length,
      totals: byCurrency,
    }
  }, [donations])

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Donation['status'] }) => {
      const payload: Record<string, unknown> = { status }
      if (status === 'confirmed') {
        payload.confirmed_at = new Date().toISOString()
        const { data: u } = await supabase.auth.getUser()
        payload.confirmed_by = u.user?.id ?? null
      } else {
        payload.confirmed_at = null
        payload.confirmed_by = null
      }
      const { error } = await supabase.from('donations').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-donations'] })
      toast.success('Donation updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('donations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-donations'] })
      toast.success('Donation deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const exportCSV = () => {
    const csv = toCSV(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `donations-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link to="/admin/dashboard">
                <ArrowLeft className="size-4" /> Back to Admin
              </Link>
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="text-primary" /> Donations
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage donations, confirm transfers, and configure the donate page.
            </p>
          </div>
          <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
            <Download /> Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Clock className="size-5 text-yellow-500" />
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Confirmed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                {stats.confirmed}
              </div>
            </CardContent>
          </Card>
          {Object.entries(stats.totals)
            .slice(0, 2)
            .map(([c, total]) => (
              <Card key={c}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total ({c})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {total.toLocaleString()} {c}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">Donations</TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon className="size-4 mr-1" /> Page Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, email, reference…"
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-12 text-center text-muted-foreground text-sm">
                    No donations match these filters yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="py-2 px-2">When</th>
                          <th className="py-2 px-2">Donor</th>
                          <th className="py-2 px-2 text-right">Amount</th>
                          <th className="py-2 px-2">Method</th>
                          <th className="py-2 px-2">Reference</th>
                          <th className="py-2 px-2">Status</th>
                          <th className="py-2 px-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((d) => (
                          <tr
                            key={d.id}
                            className="border-b border-border/60 hover:bg-muted/30 align-top"
                          >
                            <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                              {format(new Date(d.created_at), 'MMM d, HH:mm')}
                            </td>
                            <td className="py-3 px-2">
                              <div className="font-medium text-foreground">
                                {d.donor_name}
                                {d.is_anonymous && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">
                                    anon
                                  </Badge>
                                )}
                              </div>
                              {d.donor_email && (
                                <div className="text-xs text-muted-foreground">
                                  {d.donor_email}
                                </div>
                              )}
                              {d.message && (
                                <div className="text-xs text-muted-foreground italic mt-1 max-w-xs">
                                  “{d.message}”
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold whitespace-nowrap">
                              {Number(d.amount).toLocaleString()} {d.currency}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground capitalize">
                              {d.payment_method.replace('_', ' ')}
                            </td>
                            <td className="py-3 px-2 text-muted-foreground text-xs break-all max-w-[140px]">
                              {d.reference || '—'}
                            </td>
                            <td className="py-3 px-2">
                              <span
                                className={`inline-block text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[d.status]}`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right whitespace-nowrap">
                              <div className="flex justify-end gap-1">
                                {d.status !== 'confirmed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateStatus.mutate({ id: d.id, status: 'confirmed' })
                                    }
                                    title="Confirm"
                                  >
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                  </Button>
                                )}
                                {d.status !== 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateStatus.mutate({ id: d.id, status: 'rejected' })
                                    }
                                    title="Reject"
                                  >
                                    <XCircle className="size-4 text-red-600" />
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" title="Delete">
                                      <Trash2 className="size-4 text-muted-foreground" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete donation?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This permanently removes the donation record from{' '}
                                        <strong>{d.donor_name}</strong>. This cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => remove.mutate(d.id)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsForm settings={settings} updateSetting={updateSetting} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function SettingsForm({
  settings,
  updateSetting,
}: {
  settings: Record<string, string>
  updateSetting: ReturnType<typeof useSiteSettings>['updateSetting']
}) {
  const [form, setForm] = useState({
    donation_enabled: (settings.donation_enabled ?? 'true') !== 'false',
    donation_goal: settings.donation_goal || '',
    donation_currency: settings.donation_currency || 'NGN',
    donation_intro: settings.donation_intro || '',
    donation_bank_details: settings.donation_bank_details || '',
    donation_suggested_amounts: settings.donation_suggested_amounts || '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        updateSetting.mutateAsync({
          key: 'donation_enabled',
          value: form.donation_enabled ? 'true' : 'false',
        }),
        updateSetting.mutateAsync({ key: 'donation_goal', value: form.donation_goal }),
        updateSetting.mutateAsync({ key: 'donation_currency', value: form.donation_currency }),
        updateSetting.mutateAsync({ key: 'donation_intro', value: form.donation_intro }),
        updateSetting.mutateAsync({
          key: 'donation_bank_details',
          value: form.donation_bank_details,
        }),
        updateSetting.mutateAsync({
          key: 'donation_suggested_amounts',
          value: form.donation_suggested_amounts,
        }),
      ])
      toast.success('Donation settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Donate page configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 max-w-2xl">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm">Donations open</Label>
            <p className="text-xs text-muted-foreground">
              Toggle off to temporarily hide the donation form.
            </p>
          </div>
          <Switch
            checked={form.donation_enabled}
            onCheckedChange={(v) => setForm({ ...form, donation_enabled: v })}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="goal">Fundraising goal</Label>
            <Input
              id="goal"
              type="number"
              min="0"
              value={form.donation_goal}
              onChange={(e) => setForm({ ...form, donation_goal: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="cur">Display currency</Label>
            <Select
              value={form.donation_currency}
              onValueChange={(v) => setForm({ ...form, donation_currency: v })}
            >
              <SelectTrigger id="cur" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['NGN', 'USD', 'GBP', 'EUR'].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="suggested">Suggested amounts (comma-separated)</Label>
          <Input
            id="suggested"
            value={form.donation_suggested_amounts}
            onChange={(e) =>
              setForm({ ...form, donation_suggested_amounts: e.target.value })
            }
            placeholder="1000,5000,10000,25000,50000"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="intro">Intro message</Label>
          <Textarea
            id="intro"
            value={form.donation_intro}
            onChange={(e) => setForm({ ...form, donation_intro: e.target.value })}
            className="mt-1 min-h-[80px]"
          />
        </div>

        <div>
          <Label htmlFor="bank">Bank / payment details (shown to donors)</Label>
          <Textarea
            id="bank"
            value={form.donation_bank_details}
            onChange={(e) => setForm({ ...form, donation_bank_details: e.target.value })}
            className="mt-1 min-h-[140px] font-mono text-sm"
          />
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save settings
        </Button>
      </CardContent>
    </Card>
  )
}
