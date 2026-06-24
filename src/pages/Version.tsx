import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type NativeInfo = { version: string; build: string; id: string; name: string } | null

export default function Version() {
  const webVersion = __APP_VERSION__
  const buildTime = __BUILD_TIME__
  const buildCommit = __BUILD_COMMIT__
  const platform = Capacitor.getPlatform()
  const isNative = Capacitor.isNativePlatform()
  const [native, setNative] = useState<NativeInfo>(null)

  useEffect(() => {
    if (!isNative) return
    // Dynamically import @capacitor/app so the web build doesn't require it.
    import('@capacitor/app')
      .then(async ({ App }) => {
        const info = await App.getInfo()
        setNative({ version: info.version, build: info.build, id: info.id, name: info.name })
      })
      .catch(() => {
        /* @capacitor/app not installed — fall back to web version only */
      })
  }, [isNative])

  const formattedBuildTime = (() => {
    try { return new Date(buildTime).toLocaleString() } catch { return buildTime }
  })()

  const copyAll = async () => {
    const text = [
      `App: ${native?.name ?? 'AbiaConnect'}`,
      `Platform: ${platform}`,
      `Web version: ${webVersion}`,
      native ? `Native version: ${native.version} (build ${native.build})` : null,
      native ? `Bundle id: ${native.id}` : null,
      `Build commit: ${buildCommit}`,
      `Built at: ${formattedBuildTime}`,
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Version info copied')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono text-right break-all">{value}</span>
    </div>
  )

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Version info</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Platform" value={platform} />
          <Row label="Web bundle version" value={webVersion} />
          {native && <Row label="Native app version" value={native.version} />}
          {native && <Row label="Native build number" value={native.build} />}
          {native && <Row label="Bundle identifier" value={native.id} />}
          <Row label="Build commit" value={buildCommit} />
          <Row label="Built at" value={formattedBuildTime} />

          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={copyAll}>Copy details</Button>
            <Button variant="ghost" onClick={() => location.reload()}>Reload</Button>
          </div>

          {!isNative && (
            <p className="mt-6 text-xs text-muted-foreground">
              Running in a browser. Native version and build number appear only inside the installed mobile app.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
