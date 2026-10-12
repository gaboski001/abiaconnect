import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { formatWhatsAppNumber, normaliseWhatsAppNumber } from '@/lib/whatsapp'

// The table is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Dashboard -> Settings -> Notifications: the member's WhatsApp number and
 * their permission to be messaged on it. Saving the number is the opt-in;
 * removing it withdraws the permission. Only the member can see the number.
 */
export function WhatsAppUpdatesSetting() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [number, setNumber] = useState('')
  const [agreed, setAgreed] = useState(false)

  const key = ['whatsapp-contact', user?.id]
  const q = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from('whatsapp_contacts').select('phone').eq('user_id', user!.id).maybeSingle()
      if (error) throw error
      return (data?.phone as string | undefined) ?? null
    },
  })

  const save = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await db.from('whatsapp_contacts').upsert({ user_id: user!.id, phone }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      setEditing(false)
      setAgreed(false)
      toast.success('WhatsApp updates are on.')
    },
    onError: () => toast.error('Could not save your number. Please try again.'),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await db.from('whatsapp_contacts').delete().eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      setNumber('')
      toast.success('Your number was removed. You will not get WhatsApp updates.')
    },
    onError: () => toast.error('Could not remove your number. Please try again.'),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const phone = normaliseWhatsAppNumber(number)
    if (!phone) {
      return toast.error('Please enter the full number with its country code, for example +234 801 234 5678.')
    }
    if (!agreed) return toast.error('Please tick the box to agree to WhatsApp updates.')
    save.mutate(phone)
  }

  if (!user) return null
  const saved = q.data ?? null
  const showForm = editing || (!saved && !q.isLoading && !q.isError)

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${saved ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'}`}>
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">WhatsApp updates</p>
          <p className="text-xs text-slate-300/68">
            Birthday wishes, membership reminders and news from AbiaConnect on WhatsApp. Optional. Other members never see
            your number.
          </p>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-xs text-slate-300/68">Loading…</p>
      ) : q.isError ? (
        <p className="text-xs text-rose-300">Could not load your WhatsApp setting. Please try again later.</p>
      ) : showForm ? (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="whatsapp-number" className="text-xs font-semibold text-slate-200">
              WhatsApp number
            </Label>
            <Input
              id="whatsapp-number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              maxLength={24}
              placeholder="+234 801 234 5678"
              className="mt-1 h-11 rounded-2xl border-white/10 bg-slate-950/40 text-white"
            />
            <p className="mt-1 text-xs text-slate-300/68">Outside Nigeria, start with + and your country code.</p>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="whatsapp-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5 border-white/40" />
            <Label htmlFor="whatsapp-agree" className="text-xs font-normal leading-relaxed text-slate-300/80">
              Send me WhatsApp updates from AbiaConnect on this number. I can stop them at any time by removing my number
              here.
            </Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save number'}
            </Button>
            {saved && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={save.isPending}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-emerald-300">
            On for <span className="font-semibold text-white">{formatWhatsAppNumber(saved!)}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNumber(formatWhatsAppNumber(saved!))
                setAgreed(false)
                setEditing(true)
              }}
            >
              Change
            </Button>
            <Button variant="outline" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
