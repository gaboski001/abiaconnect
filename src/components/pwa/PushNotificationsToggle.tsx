import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

const STORAGE_KEY = 'push_notifications_enabled'

function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function PushNotificationsToggle() {
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!isSupported()) {
      setSupported(false)
      return
    }
    const saved = localStorage.getItem(STORAGE_KEY) === 'true'
    // Only consider enabled if permission is actually granted
    setEnabled(saved && Notification.permission === 'granted')
  }, [])

  const onChange = async (v: boolean) => {
    if (!isSupported()) {
      toast.error('Notifications are not supported on this device')
      return
    }

    if (!v) {
      localStorage.setItem(STORAGE_KEY, 'false')
      setEnabled(false)
      toast.success('Push notifications disabled')
      return
    }

    // Enabling — prompt for permission only now
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    if (permission === 'granted') {
      localStorage.setItem(STORAGE_KEY, 'true')
      setEnabled(true)
      toast.success('Push notifications enabled')
    } else if (permission === 'denied') {
      setEnabled(false)
      localStorage.setItem(STORAGE_KEY, 'false')
      toast.error('Permission blocked. Enable notifications in your browser settings.')
    } else {
      setEnabled(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Push notifications</p>
        <p className="text-xs text-muted-foreground">
          {supported
            ? 'Get alerts on this device. You will be asked for permission when you enable.'
            : 'Not supported on this device or browser.'}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={!supported}
        aria-label="Toggle push notifications"
      />
    </div>
  )
}
