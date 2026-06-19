import { useEffect, useState } from 'react'
import { Bell, BellOff, Vibrate, Volume2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  getNotificationMode,
  setNotificationMode,
  subscribeNotificationModeChanges,
  previewNotification,
  type NotificationMode,
} from '@/lib/notificationSound'

const OPTIONS: { value: NotificationMode; label: string; icon: typeof Bell }[] = [
  { value: 'sound', label: 'Sound', icon: Volume2 },
  { value: 'vibrate', label: 'Vibrate', icon: Vibrate },
  { value: 'muted', label: 'Mute', icon: BellOff },
]

export function NotificationSoundToggle() {
  const [mode, setMode] = useState<NotificationMode>('sound')

  useEffect(() => {
    setMode(getNotificationMode())
    return subscribeNotificationModeChanges(setMode)
  }, [])

  const ActiveIcon = mode === 'muted' ? BellOff : mode === 'vibrate' ? Vibrate : Bell

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4 flex-wrap">
      <div className="flex items-start gap-3">
        <ActiveIcon
          className={`h-5 w-5 mt-0.5 ${mode === 'muted' ? 'text-muted-foreground' : 'text-primary'}`}
        />
        <div>
          <Label className="text-sm font-medium">Notification alerts</Label>
          <p className="text-xs text-muted-foreground">
            Choose how you're alerted to new notifications.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Notification alert mode"
          className="inline-flex rounded-md border bg-muted/40 p-0.5"
        >
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = mode === opt.value
            return (
              <button
                key={opt.value}
                role="radio"
                aria-checked={active}
                type="button"
                onClick={() => setNotificationMode(opt.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-[5px] transition-colors ${
                  active
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            )
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => previewNotification(mode)}
          aria-label="Test notification alert"
          disabled={mode === 'muted'}
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
