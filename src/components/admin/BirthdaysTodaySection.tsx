import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cake, CheckCircle2, Clock, Mail, MailX, RefreshCw, Search, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { BirthdayWishDialog } from '@/components/engagement/BirthdayWishDialog'

/** The server's reason for a refused request, e.g. "Too many runs, try again later". */
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
  return err instanceof Error ? err.message : 'Something went wrong'
}

const todayLabel = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

/**
 * Admin -> Birthdays today: who is celebrating today (Lagos time), whether
 * they got the greeting and email, a button to send any missing greetings
 * now, and a way to save a member's birthday for them.
 */
export default function BirthdaysTodaySection() {
  const qc = useQueryClient()

  const today = useQuery({
    queryKey: ['admin-birthdays-today'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_birthdays_today')
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 15000,
  })

  const coverage = useQuery({
    queryKey: ['admin-birthday-coverage'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_birthday_coverage')
      if (error) throw error
      return data as { members: number; with_birthday: number }
    },
  })

  const sendNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('daily-birthday-greetings', { body: {} })
      if (error) throw new Error(await functionErrorMessage(error))
      return data as { candidates?: number; notified?: number; emailed?: number }
    },
    onSuccess: (r) => {
      const n = r?.notified ?? 0
      const e = r?.emailed ?? 0
      toast.success(
        n || e
          ? `Sent ${n} greeting${n === 1 ? '' : 's'} and ${e} email${e === 1 ? '' : 's'}`
          : 'Everyone celebrating today has already been greeted',
      )
      // Emails are logged a moment after sending; refresh twice.
      qc.invalidateQueries({ queryKey: ['admin-birthdays-today'] })
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin-birthdays-today'] }), 4000)
    },
    onError: (e: Error) => toast.error('Could not send greetings', { description: e.message }),
  })

  const [wishing, setWishing] = useState<{ id: string; name: string } | null>(null)
  const rows = today.data ?? []
  const pending = rows.filter((r) => !r.greeted).length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold flex items-center gap-2">
              <Cake className="size-4" /> Birthdays today
            </h2>
            <p className="text-sm text-muted-foreground">{todayLabel()} (Lagos time)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => today.refetch()} disabled={today.isFetching}>
              <RefreshCw className={today.isFetching ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button size="sm" onClick={() => sendNow.mutate()} disabled={sendNow.isPending}>
              <Send /> {sendNow.isPending ? 'Sending…' : 'Send greetings now'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Greetings go out automatically at 07:00, 08:00 and 09:00, and straight away when a member saves a birthday that is
          today. "Send greetings now" only greets members who haven't been greeted yet; nobody is greeted twice.
          Their followers are told it's their birthday, and everyone sees "Birthdays today" on their home screen to send
          wishes. Your own wish shows first, as a wish from the AbiaConnect team.
        </p>

        {today.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : today.isError ? (
          <p className="text-sm text-destructive">Could not load today's birthdays.</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No member has today's date saved as their birthday.
            <br />
            If you know someone celebrating today, add their birthday below and they'll be greeted straight away.
          </div>
        ) : (
          <>
            {pending > 0 && (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {pending} member{pending === 1 ? ' hasn’t' : 's haven’t'} been greeted yet. Press "Send greetings now".
              </p>
            )}
            <ul className="divide-y rounded-xl border">
              {rows.map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center gap-3 p-3">
                  <UserAvatar avatarUrl={r.avatar_url} displayName={r.display_name || r.username || 'Member'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.display_name || r.username || 'Member'}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.username ? `@${r.username} · ` : ''}turning {r.turning}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.greeted ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.greeted ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                    {r.greeted ? 'Greeted' : 'Not greeted yet'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.emailed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.emailed ? <Mail className="size-3" /> : <MailX className="size-3" />}
                    {!r.has_email ? 'No email on file' : r.emailed ? 'Email sent' : 'Email not sent'}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setWishing({ id: r.user_id, name: r.display_name || r.username || 'Member' })}
                  >
                    🎂 Send the team’s wishes
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}

        {coverage.data && (
          <p className="text-xs text-muted-foreground">
            {coverage.data.with_birthday} of {coverage.data.members} members have a birthday saved. Members without one see an
            "Add your birthday" card on their home page.
          </p>
        )}
      </section>

      <BirthdayWishDialog person={wishing} asTeam onClose={() => setWishing(null)} />

      <SetMemberBirthday
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin-birthday-coverage'] })
          // The instant-greeting trigger runs in the background; refresh shortly after.
          setTimeout(() => qc.invalidateQueries({ queryKey: ['admin-birthdays-today'] }), 2500)
          setTimeout(() => qc.invalidateQueries({ queryKey: ['admin-birthdays-today'] }), 8000)
        }}
      />
    </div>
  )
}

function SetMemberBirthday({ onSaved }: { onSaved: () => void }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<{ user_id: string; name: string } | null>(null)
  const [dob, setDob] = useState('')

  const results = useQuery({
    queryKey: ['admin-find-members', q.trim()],
    enabled: q.trim().length >= 2 && !picked,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_find_members', { _q: q.trim() })
      if (error) throw error
      return data ?? []
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!picked || !dob) throw new Error('Pick a member and a date first')
      const { error } = await supabase.rpc('admin_set_member_dob', { _user_id: picked.user_id, _dob: dob })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`Birthday saved for ${picked?.name}`, {
        description: 'If it is today, their greeting and email are on the way.',
      })
      setPicked(null)
      setQ('')
      setDob('')
      onSaved()
    },
    onError: (e: Error) => toast.error('Could not save birthday', { description: e.message }),
  })

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h2 className="font-bold">Add a member's birthday</h2>
      <p className="text-sm text-muted-foreground">
        For members who told you their birthday but haven't saved it. If the date is today, they are greeted straight away.
      </p>

      {!picked ? (
        <div className="space-y-2">
          <Label htmlFor="bday-search">Find member</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="bday-search"
              placeholder="Name or username"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {results.data && results.data.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {results.data.map((m) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/50"
                    onClick={() => {
                      setPicked({ user_id: m.user_id, name: m.display_name || m.username || 'Member' })
                      setDob(m.dob ?? '')
                    }}
                  >
                    <span>
                      <span className="font-medium">{m.display_name || m.username}</span>
                      {m.username && <span className="text-xs text-muted-foreground"> @{m.username}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.dob ? 'Birthday saved' : 'No birthday'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.data && results.data.length === 0 && q.trim().length >= 2 && (
            <p className="text-sm text-muted-foreground">No members found.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Member: <span className="font-semibold">{picked.name}</span>{' '}
            <button type="button" className="text-primary underline" onClick={() => setPicked(null)}>
              change
            </button>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="bday-date">Date of birth</Label>
              <Input
                id="bday-date"
                type="date"
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dob}>
              {save.isPending ? 'Saving…' : 'Save birthday'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
