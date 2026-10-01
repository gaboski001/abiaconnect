import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Heart, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Plan } from '@/lib/monetization/api'
import { toast } from '@/lib/toast'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export type MonetizationTab = 'start' | 'overview' | 'providers' | 'plans' | 'transactions' | 'logs' | 'subscriptions' | 'audit'

interface SetupStatus {
  paid_plan_active: boolean
  keys_saved: boolean
  provider_enabled: boolean
  webhook_received: boolean
  test_payment_ok: boolean
  live_enabled: boolean
  dating_profiles: number
  matches: number
}

const errMsg = (e: unknown) => (e as { message?: string })?.message || 'Something went wrong'

/** Plain-language setup checklist + the settings admins change most. */
export function DatingGettingStarted({ goTo }: { goTo: (tab: MonetizationTab) => void }) {
  const status = useQuery({
    queryKey: ['admin-dating-setup-status'],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_dating_setup_status')
      if (error) throw error
      return data as SetupStatus
    },
  })
  const s = status.data

  const steps: Array<{ done: boolean; title: string; help: string; tab: MonetizationTab; action: string }> = [
    {
      done: !!s?.paid_plan_active,
      title: 'Set your prices and switch on a paid plan',
      help: 'Paid plans start switched off. Check the price, then turn on "Active (can be bought)".',
      tab: 'plans',
      action: 'Open plans',
    },
    {
      done: !!s?.keys_saved,
      title: 'Save your payment keys',
      help: 'Paste the test keys from your Paystack, Monnify or Squad dashboard. They are stored encrypted.',
      tab: 'providers',
      action: 'Add keys',
    },
    {
      done: !!s?.provider_enabled,
      title: 'Switch on a payment provider',
      help: 'Turn on at least one provider. If you turn on more than one, members choose at checkout.',
      tab: 'providers',
      action: 'Open payments',
    },
    {
      done: !!s?.webhook_received,
      title: 'Connect the webhook',
      help: 'Copy the webhook URL shown for your provider and paste it into that provider’s dashboard. This ticks once the first notification arrives.',
      tab: 'providers',
      action: 'Copy webhook URL',
    },
    {
      done: !!s?.test_payment_ok,
      title: 'Make a test payment',
      help: 'With the provider in Test mode, buy a plan on the Premium page using a test card.',
      tab: 'transactions',
      action: 'View payments',
    },
    {
      done: !!s?.live_enabled,
      title: 'Go live',
      help: 'Save your live keys, then switch the provider to Live mode to accept real payments.',
      tab: 'providers',
      action: 'Go live',
    },
  ]
  const doneCount = steps.filter((x) => x.done).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <Users className="size-5 text-pink-600" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Active dating profiles</p>
            <p className="text-xl font-bold">{s?.dating_profiles ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <Heart className="size-5 text-pink-600" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">Matches made</p>
            <p className="text-xl font-bold">{s?.matches ?? '—'}</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="setup-title" className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="setup-title" className="font-semibold">Setup checklist</h3>
          <span className="text-sm text-muted-foreground">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label="Done" />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Not done yet" />
                )}
                <div>
                  <p className="font-medium">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.help}</p>
                </div>
              </div>
              {!step.done && (
                <Button size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={() => goTo(step.tab)}>
                  {step.action}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <QuickSettings />
    </div>
  )
}

function QuickSettings() {
  const qc = useQueryClient()
  const free = useQuery({
    queryKey: ['admin-free-plan'],
    queryFn: async () => {
      const { data, error } = await db.from('subscription_plans').select('*').eq('code', 'free').single()
      if (error) throw error
      return data as Plan
    },
  })
  const setting = useQuery({
    queryKey: ['admin-dating-settings'],
    queryFn: async () => {
      const { data, error } = await db.from('dating_settings').select('key, value')
      if (error) throw error
      const map = new Map((data as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]))
      return { restrictAll: map.get('restrict_all_new_conversations_to_matches') === true }
    },
  })

  const [likes, setLikes] = useState('')
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (free.data) {
      setLikes(free.data.limits.daily_likes == null ? '' : String(free.data.limits.daily_likes))
      setPreview(String(free.data.limits.likes_you_preview ?? 0))
    }
  }, [free.data])

  const saveFree = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await db
        .from('subscription_plans')
        .update({ limits: { ...free.data!.limits, ...patch } })
        .eq('code', 'free')
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Saved')
      qc.invalidateQueries({ queryKey: ['admin-free-plan'] })
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })
  const saveRestrict = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await db
        .from('dating_settings')
        .update({ value: on })
        .eq('key', 'restrict_all_new_conversations_to_matches')
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Saved')
      qc.invalidateQueries({ queryKey: ['admin-dating-settings'] })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  if (free.isLoading) return <p className="text-sm text-muted-foreground">Loading settings…</p>
  if (free.error) return <p className="text-sm text-destructive">{errMsg(free.error)}</p>
  const limits = free.data!.limits

  const likesValid = likes === '' || (/^\d+$/.test(likes) && Number(likes) <= 1000)
  const previewValid = /^\d+$/.test(preview) && Number(preview) <= 50

  return (
    <section aria-labelledby="quick-title" className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 id="quick-title" className="font-semibold">Quick settings for free members</h3>
        <p className="text-sm text-muted-foreground">These apply to everyone on the Free plan. Paid plans are set in "Plans & prices".</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="free-likes">Likes per day</Label>
          <div className="flex gap-2">
            <Input
              id="free-likes"
              inputMode="numeric"
              value={likes}
              onChange={(e) => setLikes(e.target.value.trim())}
              placeholder="Unlimited"
              aria-invalid={!likesValid}
            />
            <Button
              variant="outline"
              disabled={!likesValid || saveFree.isPending}
              onClick={() => saveFree.mutate({ daily_likes: likes === '' ? null : Number(likes) })}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Resets every midnight (Nigeria time). Leave empty for unlimited.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="free-preview">Blurred "likes" shown to free members</Label>
          <div className="flex gap-2">
            <Input id="free-preview" inputMode="numeric" value={preview} onChange={(e) => setPreview(e.target.value.trim())} aria-invalid={!previewValid} />
            <Button
              variant="outline"
              disabled={!previewValid || saveFree.isPending}
              onClick={() => saveFree.mutate({ likes_you_preview: Number(preview) })}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">How many locked tiles free members see on "Likes you". Names stay hidden.</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div>
          <Label htmlFor="free-msg" className="font-medium">Free members can message before matching</Label>
          <p className="text-xs text-muted-foreground">
            Off (recommended): free members can chat once they match. Messaging anyone first is a Premium benefit.
          </p>
        </div>
        <Switch
          id="free-msg"
          checked={!!limits.message_without_match}
          onCheckedChange={(v) => saveFree.mutate({ message_without_match: v })}
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div>
          <Label htmlFor="restrict-all" className="font-medium">Apply "match first" to all private messages</Label>
          <p className="text-xs text-muted-foreground">
            Off: the rule only applies in Relationship. On: free members also can't start new forum private chats unless they
            have matched. Existing chats are never affected.
          </p>
        </div>
        <Switch
          id="restrict-all"
          checked={!!setting.data?.restrictAll}
          disabled={setting.isLoading}
          onCheckedChange={(v) => saveRestrict.mutate(v)}
        />
      </div>
    </section>
  )
}

export default DatingGettingStarted
