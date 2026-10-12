import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MailPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Switch } from '@/components/ui/switch'

type Key = 'premium_invite' | 'support_appeal'
type Status = Record<Key, { enabled: boolean; sent_30d: number; unsubscribed: number }>

const EMAILS: { key: Key; name: string; about: string }[] = [
  {
    key: 'premium_invite',
    name: 'Premium invitation',
    about:
      'Sent at 9:00 am to free members who used all their connection requests the day before. At most once every 30 days per member.',
  },
  {
    key: 'support_appeal',
    name: 'Support appeal',
    about:
      'Sent at 10:00 am to active members, 150 a day, with a link to the Donate page. At most once every three months per member.',
  },
]

// The functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Admin -> Email Settings: on/off switches for the emails AbiaConnect sends
 * to members by itself. Switching one off stops it from the next morning;
 * members who unsubscribed stay unsubscribed either way.
 */
export default function MemberEmailsSection() {
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['admin-member-emails'],
    queryFn: async () => {
      const { data, error } = await db.rpc('admin_member_email_status')
      if (error) throw error
      return data as Status
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: Key; enabled: boolean }) => {
      const { error } = await db.rpc('admin_set_member_email', { _key: key, _enabled: enabled })
      if (error) throw error
      return enabled
    },
    onSuccess: (enabled, { key }) => {
      qc.invalidateQueries({ queryKey: ['admin-member-emails'] })
      const name = EMAILS.find((e) => e.key === key)!.name
      toast.success(enabled ? `${name} emails are switched on.` : `${name} emails are switched off.`)
    },
    onError: () => toast.error('Could not save the change. Please try again.'),
  })

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 font-bold">
          <MailPlus className="size-4" /> Emails to members
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These go out by themselves every morning. Switch one off to stop it; nothing is sent again until you switch it
          back on.
        </p>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.isError || !q.data ? (
        <p className="text-sm text-destructive">Could not load the email switches.</p>
      ) : (
        <ul className="space-y-3">
          {EMAILS.map((e) => {
            const s = q.data[e.key]
            const id = `member-email-${e.key}`
            return (
              <li key={e.key} className="flex items-start justify-between gap-4 rounded-xl border p-4">
                <div className="min-w-0 space-y-1">
                  <label htmlFor={id} className="font-semibold">
                    {e.name}
                  </label>
                  <p className="text-sm text-muted-foreground">{e.about}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.sent_30d} sent in the last 30 days · {s.unsubscribed} unsubscribed ·{' '}
                    <span className={s.enabled ? 'font-medium text-primary' : 'font-medium text-destructive'}>
                      {s.enabled ? 'On' : 'Off'}
                    </span>
                  </p>
                </div>
                <Switch
                  id={id}
                  checked={s.enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(enabled) => toggle.mutate({ key: e.key, enabled })}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
