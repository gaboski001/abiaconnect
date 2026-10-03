import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Cake, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { saveProfile } from '@/lib/profileUpdate'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const dismissKey = (uid: string) => `abiaconnect-birthday-prompt-dismissed:${uid}`

function isDismissed(uid: string) {
  try {
    return localStorage.getItem(dismissKey(uid)) === '1'
  } catch {
    return false
  }
}

/**
 * Asks members who have no date of birth saved to add it, so the platform
 * can send them birthday wishes. Saves in place; "Not now" hides it on this
 * device. Shown only to signed-in members without a birthday on file.
 */
export function AddBirthdayPrompt({ className }: { className?: string }) {
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const qc = useQueryClient()
  const [dob, setDob] = useState('')
  const [saving, setSaving] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (!user || isLoading || !profile || profile.dob || hidden || isDismissed(user.id)) return null

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(user.id), '1')
    } catch {
      /* private mode: just hide for now */
    }
    setHidden(true)
  }

  const save = async () => {
    if (!dob) return toast.error('Pick your date of birth first')
    setSaving(true)
    const { error } = await saveProfile(user.id, { dob })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Birthday saved 🎂 We’ll celebrate you on your day!')
    setHidden(true)
    qc.invalidateQueries({ queryKey: ['profile', user.id] })
  }

  return (
    <section
      aria-label="Add your birthday"
      className={cn('relative rounded-2xl border border-primary/30 bg-card p-4 shadow-sm', className)}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden>
          <Cake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">Add your birthday so we can celebrate you 🎂</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The AbiaConnect family will send you birthday wishes on your day.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Date of birth"
              value={dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDob(e.target.value)}
              className="h-10 w-auto min-w-[10rem]"
            />
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save birthday'}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
