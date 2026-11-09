import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { QUICK_WISHES, sendBirthdayWish } from '@/lib/birthday'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type Person = { id: string; name: string }

/**
 * Write or pick a birthday wish. Used on the home card ("Birthdays today") and
 * by admins in Admin -> Birthdays today, where it goes as the team's wish.
 * Pass several people to send the same wish to everyone celebrating today.
 */
export function BirthdayWishDialog({
  person,
  asTeam = false,
  onClose,
  onSent,
}: {
  person: Person | Person[] | null
  asTeam?: boolean
  onClose: () => void
  /** The people whose wish went through (or who had already been wished). */
  onSent?: (ids: string[]) => void
}) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const people = person ? (Array.isArray(person) ? person : [person]) : []
  const many = people.length > 1
  const first = many ? 'everyone' : people[0]?.name.split(' ')[0] ?? ''

  const send = async () => {
    if (!people.length || !text.trim()) return
    setBusy(true)
    try {
      const results = await Promise.allSettled(people.map((p) => sendBirthdayWish(p.id, text.trim())))
      const done = people.filter((_, i) => results[i].status === 'fulfilled').map((p) => p.id)
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (!done.length) throw failed?.reason ?? new Error()
      if (many) {
        toast.success(
          done.length === people.length
            ? `Your wishes are on their way to all ${people.length} of them 🎉`
            : `Your wishes went to ${done.length} of ${people.length}. Please try the others again.`,
        )
      } else {
        const sent = (results[0] as PromiseFulfilledResult<boolean>).value
        toast.success(sent ? `Your wishes are on their way to ${first} 🎉` : `You already sent ${first} your wishes today.`)
      }
      onSent?.(done)
      qc.invalidateQueries({ queryKey: ['birthdays-today'] })
      setText('')
      onClose()
    } catch (e) {
      toast.error((e as Error).message || 'Could not send your wishes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={people.length > 0} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>🎂 Wish {first} a happy birthday</DialogTitle>
          <DialogDescription>
            {asTeam
              ? 'This goes to them as a wish from the AbiaConnect team.'
              : many
                ? `Your message goes to each of the ${people.length} people celebrating today, with your name.`
                : 'They get a notification with your name and message.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tap one, or write your own</p>
          <div className="flex flex-col gap-2">
            {QUICK_WISHES.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setText(w)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  text === w && 'border-primary bg-primary/10',
                )}
              >
                {w}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Your birthday wish"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            placeholder={many ? 'Write something kind for them…' : `Write something kind for ${first}…`}
            rows={3}
          />
          <p className="text-right text-xs text-muted-foreground">{text.length}/280</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={busy || !text.trim()}>
            <Send className="size-4" /> {busy ? 'Sending…' : many ? `Send to all ${people.length}` : 'Send wishes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
