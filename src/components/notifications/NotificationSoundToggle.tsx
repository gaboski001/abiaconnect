import { useEffect, useState } from 'react'
import { Bell, BellOff, Volume2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  isNotificationSoundMuted,
  setNotificationSoundMuted,
  subscribeNotificationSoundChanges,
  playNotificationChime,
} from '@/lib/notificationSound'

export function NotificationSoundToggle() {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setMuted(isNotificationSoundMuted())
    return subscribeNotificationSoundChanges(setMuted)
  }, [])

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        {muted ? (
          <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
        ) : (
          <Bell className="h-5 w-5 text-primary mt-0.5" />
        )}
        <div>
          <Label htmlFor="notif-sound" className="text-sm font-medium">
            Notification sound
          </Label>
          <p className="text-xs text-muted-foreground">
            Play a soft chime when a new notification arrives.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            // Temporarily unmute so the test always plays.
            const wasMuted = isNotificationSoundMuted()
            if (wasMuted) setNotificationSoundMuted(false)
            playNotificationChime()
            if (wasMuted) setNotificationSoundMuted(true)
          }}
          aria-label="Play sample notification sound"
        >
          <Volume2 className="h-4 w-4" />
        </Button>
        <Switch
          id="notif-sound"
          checked={!muted}
          onCheckedChange={(on) => setNotificationSoundMuted(!on)}
        />
      </div>
    </div>
  )
}
