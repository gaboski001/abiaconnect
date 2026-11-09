import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Switch } from '@/components/ui/switch'
import { setShareBirthday } from '@/lib/birthday'
import { toast } from '@/lib/toast'

/**
 * "Let members celebrate my birthday": when on, members see you under
 * "Birthdays today" and your followers are told. Only the day is shared,
 * never the year or your age. Saves straight away.
 */
export function BirthdayShareSwitch({ initial, userId }: { initial: boolean; userId: string }) {
  const qc = useQueryClient()
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)
  const change = async (v: boolean) => {
    setOn(v)
    setBusy(true)
    try {
      await setShareBirthday(v)
      qc.invalidateQueries({ queryKey: ['profile', userId] })
      toast.success(v ? 'Members can celebrate your birthday with you' : 'Your birthday is now private')
    } catch {
      setOn(!v)
      toast.error('Could not save that. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <Switch checked={on} onCheckedChange={change} disabled={busy} aria-label="Let members celebrate my birthday" />
      <span className="text-sm">
        <span className="block font-medium">Let members celebrate my birthday</span>
        <span className="block text-xs text-muted-foreground">
          On your birthday, members can send you wishes. They only see the day, never the year or your age.
        </span>
      </span>
    </label>
  )
}
