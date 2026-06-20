import { useEffect, useState } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { isStandalone } from '@/lib/pwaInstall'

export function PWAInstallStatus() {
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const update = () => setInstalled(isStandalone())
    update()

    const mql = window.matchMedia('(display-mode: standalone)')
    mql.addEventListener?.('change', update)
    window.addEventListener('appinstalled', update)

    return () => {
      mql.removeEventListener?.('change', update)
      window.removeEventListener('appinstalled', update)
    }
  }, [])

  if (installed) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      >
        <CheckCircle2 className="size-3.5" />
        Installed on this device
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <Download className="size-3.5" />
      Not installed
    </Badge>
  )
}
