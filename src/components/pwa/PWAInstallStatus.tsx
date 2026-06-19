import { useEffect, useState } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { isStandalone } from '@/lib/pwaInstall'

export function PWAInstallStatus() {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
  }, [])

  if (installed) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="size-4" />
        <span>App installed</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Download className="size-4" />
      <span>Not installed</span>
    </div>
  )
}
