import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { toast } from '@/lib/toast'
import { ArrowDown, ArrowUp, Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type AccountType = 'bank' | 'crypto' | 'mobile_money'
type DonationAccount = {
  id: string
  account_type: AccountType
  account_name: string
  account_number: string | null
  bank_name: string | null
  crypto_currency: string | null
  crypto_network: string | null
  wallet_address: string | null
  description: string | null
  is_active: boolean
  order_index: number
}

const TYPE_LABEL: Record<AccountType, string> = {
  bank: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  crypto: 'Cryptocurrency',
}

const AccountForm = lazy(() => Promise.resolve({ default: AccountFormImpl }))

export default function AdminDonations() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<DonationAccount | null>(null)
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<DonationAccount | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['donation_accounts', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('donation_accounts')
        .select('*')
        .order('order_index', { ascending: true })
      if (error) throw error
      return data as DonationAccount[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('donation_accounts_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donation_accounts' }, () => {
        qc.invalidateQueries({ queryKey: ['donation_accounts', 'admin'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])

  const toggleActive = useMutation({
    mutationFn: async (row: DonationAccount) => {
      const { error } = await supabase
        .from('donation_accounts')
        .update({ is_active: !row.is_active })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['donation_accounts'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: DonationAccount; b: DonationAccount }) => {
      const { error: e1 } = await supabase
        .from('donation_accounts')
        .update({ order_index: b.order_index })
        .eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('donation_accounts')
        .update({ order_index: a.order_index })
        .eq('id', b.id)
      if (e2) throw e2
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['donation_accounts'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('donation_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['donation_accounts'] })
      toast.success('Account deleted')
      setToDelete(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data ?? []
  const nextOrder = useMemo(() => (rows.length ? Math.max(...rows.map((r) => r.order_index)) + 1 : 0), [rows])

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Donation Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage the donation channels shown on the public Donate page.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Add New Account</Button>
      </div>

      <div
        className="flex items-start gap-3 rounded-xl border-2 p-4"
        style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b', color: '#451a03' }}
      >
        <Lock className="size-5 shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed">
          <p className="font-semibold">🔒 Admin Reminder</p>
          <p>
            Only activate account details that belong to official AbiaConnect platform accounts. Never add personal
            accounts. All active accounts are publicly visible to all users on the <code>/donate</code> page.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No donation accounts yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <Card key={row.id}>
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <Badge variant="outline">{TYPE_LABEL[row.account_type]}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{row.account_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.bank_name || row.crypto_currency || ''}
                    {row.crypto_network && ` • ${row.crypto_network}`}
                    {row.account_number && ` • ${row.account_number}`}
                    {row.wallet_address && ` • ${row.wallet_address.slice(0, 14)}…`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.is_active}
                    onCheckedChange={() => toggleActive.mutate(row)}
                    aria-label="Toggle active"
                  />
                  <span className="text-xs text-muted-foreground w-14">{row.is_active ? 'Active' : 'Hidden'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon"
                    disabled={idx === 0}
                    onClick={() => reorder.mutate({ a: row, b: rows[idx - 1] })}
                    aria-label="Move up"
                  ><ArrowUp className="size-4" /></Button>
                  <Button
                    variant="ghost" size="icon"
                    disabled={idx === rows.length - 1}
                    onClick={() => reorder.mutate({ a: row, b: rows[idx + 1] })}
                    aria-label="Move down"
                  ><ArrowDown className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(row)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(row)} aria-label="Delete">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <Suspense fallback={null}>
          <AccountForm
            row={editing}
            defaultOrder={nextOrder}
            onClose={() => { setCreating(false); setEditing(null) }}
            onSaved={() => qc.invalidateQueries({ queryKey: ['donation_accounts'] })}
          />
        </Suspense>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete donation account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{toDelete?.account_name}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccountFormImpl({
  row,
  defaultOrder,
  onClose,
  onSaved,
}: {
  row: DonationAccount | null
  defaultOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<AccountType>(row?.account_type ?? 'bank')
  const [accountName, setAccountName] = useState(row?.account_name ?? '')
  const [accountNumber, setAccountNumber] = useState(row?.account_number ?? '')
  const [bankName, setBankName] = useState(row?.bank_name ?? '')
  const [cryptoCurrency, setCryptoCurrency] = useState(row?.crypto_currency ?? '')
  const [cryptoNetwork, setCryptoNetwork] = useState(row?.crypto_network ?? '')
  const [walletAddress, setWalletAddress] = useState(row?.wallet_address ?? '')
  const [description, setDescription] = useState(row?.description ?? '')
  const [isActive, setIsActive] = useState(row?.is_active ?? false)
  const [orderIndex, setOrderIndex] = useState<number>(row?.order_index ?? defaultOrder)
  const [saving, setSaving] = useState(false)

  const qrRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (type === 'crypto' && qrRef.current && walletAddress) {
      QRCode.toCanvas(qrRef.current, walletAddress, { width: 140, margin: 1 }).catch(() => {})
    }
  }, [type, walletAddress])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Per-type validation
    if (!accountName.trim()) { toast.error('Account name is required'); return }
    if (type === 'bank' && (!bankName.trim() || !accountNumber.trim())) {
      toast.error('Bank name and account number are required'); return
    }
    if (type === 'mobile_money' && (!bankName.trim() || !accountNumber.trim())) {
      toast.error('Provider and phone/account number are required'); return
    }
    if (type === 'crypto' && (!cryptoCurrency.trim() || !cryptoNetwork.trim() || !walletAddress.trim())) {
      toast.error('Cryptocurrency, network and wallet address are required'); return
    }

    setSaving(true)
    const payload = {
      account_type: type,
      account_name: accountName.trim(),
      account_number: type === 'crypto' ? null : accountNumber.trim(),
      bank_name: type === 'crypto' ? null : bankName.trim(),
      crypto_currency: type === 'crypto' ? cryptoCurrency.trim() : null,
      crypto_network: type === 'crypto' ? cryptoNetwork.trim() : null,
      wallet_address: type === 'crypto' ? walletAddress.trim() : null,
      description: description.trim() || null,
      is_active: isActive,
      order_index: orderIndex,
    }
    const { error } = row
      ? await supabase.from('donation_accounts').update(payload).eq('id', row.id)
      : await supabase.from('donation_accounts').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Account saved. Toggle it active when ready to display.')
    onSaved()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row ? 'Edit Donation Account' : 'Add Donation Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Account Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="crypto">Cryptocurrency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'bank' && (
            <>
              <Field label="Bank Name" value={bankName} onChange={setBankName} required />
              <Field label="Account Name" value={accountName} onChange={setAccountName} required />
              <Field label="Account Number" value={accountNumber} onChange={setAccountNumber} required />
            </>
          )}
          {type === 'mobile_money' && (
            <>
              <Field label="Provider Name (e.g. OPay, Palmpay)" value={bankName} onChange={setBankName} required />
              <Field label="Account Name" value={accountName} onChange={setAccountName} required />
              <Field label="Phone Number / Account Number" value={accountNumber} onChange={setAccountNumber} required />
            </>
          )}
          {type === 'crypto' && (
            <>
              <Field label="Cryptocurrency (e.g. Bitcoin, USDT)" value={cryptoCurrency} onChange={setCryptoCurrency} required />
              <Field label="Network (e.g. TRC20, ERC20, BEP20)" value={cryptoNetwork} onChange={setCryptoNetwork} required />
              <Field label="Account / Wallet Label" value={accountName} onChange={setAccountName} required />
              <Field label="Wallet Address" value={walletAddress} onChange={setWalletAddress} required />
              {walletAddress && (
                <div className="flex justify-center">
                  <canvas ref={qrRef} className="rounded-md border border-border bg-white" />
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Order</Label>
              <Input
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
              <Label htmlFor="active">Active (visible publicly)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label, value, onChange, required,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  )
}
