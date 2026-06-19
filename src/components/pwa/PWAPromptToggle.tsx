import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { getPromptEnabled, setPromptEnabled } from '@/lib/pwaInstall'

export function PWAPromptToggle() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(getPromptEnabled())
  }, [])

  const onChange = (v: boolean) => {
    setEnabled(v)
    setPromptEnabled(v)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Show install prompts</p>
        <p className="text-xs text-muted-foreground">
          Enable or disable the in-app install banner and button on this device
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} aria-label="Toggle PWA install prompts" />
    </div>
  )
}
