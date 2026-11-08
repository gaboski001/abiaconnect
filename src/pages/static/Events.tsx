import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, isSameDay } from 'date-fns'
import { CalendarDays, CalendarPlus, Globe2, Loader2, MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StaticPage from '@/components/layout/StaticPage'
import { SubmissionStatus } from '@/components/community/SubmissionStatus'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { ABIA_LGAS, fetchEvents, submitEvent, type CommunityEvent } from '@/lib/communityPages'

/** Upcoming events members sent in and the team published, grouped by month. */
export default function Events() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const q = useQuery({ queryKey: ['community-events'], queryFn: fetchEvents })

  const months = useMemo(() => {
    const groups = new Map<string, CommunityEvent[]>()
    for (const e of q.data ?? []) {
      const key = format(new Date(e.starts_at), 'MMMM yyyy')
      groups.set(key, [...(groups.get(key) ?? []), e])
    }
    return [...groups.entries()]
  }, [q.data])

  return (
    <StaticPage
      badge="Community"
      title="Events Calendar"
      subtitle="Gatherings, meetings and celebrations for Abians at home and abroad."
    >
      <p>
        Organising something for Abians, in person or online? Add it here. Our team checks every event before it is
        listed.
      </p>

      <div className="not-prose my-6">
        {user ? (
          <Button onClick={() => setOpen(true)}>
            <Plus /> Add an event
          </Button>
        ) : (
          <Button asChild>
            <Link to="/login">Sign in to add an event</Link>
          </Button>
        )}
      </div>

      <SubmissionStatus kind="event" />

      <div className="not-prose my-4 space-y-8">
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading events…
          </p>
        ) : q.isError ? (
          <p className="text-sm text-destructive">Could not load the events. Please try again.</p>
        ) : months.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <CalendarDays className="mx-auto mb-2 size-6 text-secondary" />
            <p className="font-semibold">No upcoming events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Planning something? Add it so others can join.</p>
          </div>
        ) : (
          months.map(([month, events]) => (
            <section key={month} aria-label={month}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{month}</h2>
              <div className="space-y-3">
                {events.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {user ? <EventForm open={open} onOpenChange={setOpen} /> : null}
    </StaticPage>
  )
}

/** A calendar file for "Add to my calendar" (works with Google, Apple and Outlook calendars). */
function calendarFile(e: CommunityEvent): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const start = new Date(e.starts_at)
  const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 2 * 3600_000)
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AbiaConnect//Events//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@abiaconnect.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc(e.place || e.online_link || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`
}

function EventCard({ e }: { e: CommunityEvent }) {
  const start = new Date(e.starts_at)
  const end = e.ends_at ? new Date(e.ends_at) : null
  const when = end
    ? isSameDay(start, end)
      ? `${format(start, 'EEE d MMM, h:mm a')} to ${format(end, 'h:mm a')}`
      : `${format(start, 'EEE d MMM, h:mm a')} to ${format(end, 'EEE d MMM, h:mm a')}`
    : format(start, 'EEE d MMM, h:mm a')

  return (
    <article className="flex gap-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary/15 py-2 text-secondary">
        <span className="text-[11px] font-semibold uppercase">{format(start, 'MMM')}</span>
        <span className="text-2xl font-bold leading-none">{format(start, 'd')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug text-foreground">{e.title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{when}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {e.place ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {e.place}
            </span>
          ) : null}
          {e.online_link ? (
            <a href={e.online_link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Globe2 className="size-3.5" /> Join online
            </a>
          ) : null}
          {e.lga ? <span>{e.lga}</span> : null}
        </p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{e.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <a href={calendarFile(e)} download={`${e.title.slice(0, 40).replace(/[^\w ]+/g, '').trim() || 'event'}.ics`}>
              <CalendarPlus /> Add to my calendar
            </a>
          </Button>
          {e.organiser_name ? <span className="text-xs text-muted-foreground">Added by {e.organiser_name}</span> : null}
        </div>
      </div>
    </article>
  )
}

function EventForm({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [place, setPlace] = useState('')
  const [link, setLink] = useState('')
  const [lga, setLga] = useState('')

  const starts = date && time ? new Date(`${date}T${time}`) : null
  const ends = starts && endTime ? new Date(`${date}T${endTime}`) : null
  const today = format(new Date(), 'yyyy-MM-dd')

  const send = useMutation({
    mutationFn: () =>
      submitEvent({
        title: title.trim(),
        description: description.trim(),
        starts: starts!,
        ends,
        place: place.trim(),
        link: link.trim(),
        lga,
      }),
    onSuccess: () => {
      toast.success('Thank you! Our team will check your event and let you know when it is listed.')
      for (const set of [setTitle, setDescription, setDate, setTime, setEndTime, setPlace, setLink, setLga]) set('')
      onOpenChange(false)
      qc.invalidateQueries({ queryKey: ['my-community-submissions'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const ready = title.trim().length >= 6 && description.trim().length >= 20 && !!starts && (!!place.trim() || !!link.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an event</DialogTitle>
          <DialogDescription>Times are in your phone's time zone. The team checks every event before it is listed.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) send.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Name of the event</Label>
            <Input id="ev-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Ohafia New Yam Festival 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="ev-date">Date</Label>
              <Input id="ev-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-time">Starts</Label>
              <Input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">Ends (optional)</Label>
              <Input id="ev-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-place">Where</Label>
            <Input id="ev-place" value={place} maxLength={160} onChange={(e) => setPlace(e.target.value)} placeholder="Venue and town, or leave empty if online only" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-link">Online link (optional)</Label>
            <Input id="ev-link" type="url" value={link} maxLength={500} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label id="ev-lga-label">LGA (optional)</Label>
            <Select value={lga} onValueChange={setLga}>
              <SelectTrigger aria-labelledby="ev-lga-label">
                <SelectValue placeholder="Choose the LGA it is about…" />
              </SelectTrigger>
              <SelectContent>
                {ABIA_LGAS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">What happens there?</Label>
            <Textarea id="ev-desc" value={description} maxLength={2000} rows={5} onChange={(e) => setDescription(e.target.value)} placeholder="Who is it for, what to expect, and how to take part" />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || send.isPending}>
            {send.isPending ? <Loader2 className="animate-spin" /> : null} Send for review
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
