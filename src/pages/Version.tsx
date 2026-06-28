import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Copy, RefreshCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { GOLD_GRADIENT, GOLD_GRADIENT_SOFT, GOLD_SHADOW, PREMIUM_SHADOW } from '@/lib/mobileBrand'

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
    const modName = '@capacitor/app'
    ;(0, eval)(`import(${JSON.stringify(modName)})`)
      .then(async (mod: any) => {
        const info = await mod.App.getInfo()
        setNative({ version: info.version, build: info.build, id: info.id, name: info.name })
      })
      .catch(() => {
        /* @capacitor/app not available */
      })
  }, [isNative])

  const formattedBuildTime = (() => {
    try {
      return new Date(buildTime).toLocaleString()
    } catch {
      return buildTime
    }
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
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Version info copied')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 border-b border-slate-200/80 py-3 last:border-0 dark:border-white/10">
      <span className="text-sm text-slate-600 dark:text-slate-300/76">{label}</span>
      <span className="break-all text-right font-mono text-sm text-slate-950 dark:text-slate-100">{value}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <section
        className="rounded-[2rem] border border-slate-200/80 bg-white/96 p-6 dark:border-white/10 dark:bg-[rgba(8,14,26,0.92)]"
        style={{ boxShadow: PREMIUM_SHADOW }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-white/10 dark:text-slate-200/80"
          style={{ background: GOLD_GRADIENT_SOFT }}
        >
          <Smartphone className="size-3.5" />
          Build details
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Version info</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300/76">
          Review the current web bundle and native build details for support, QA, and deployment checks.
        </p>

        <div className="mt-6 rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <Row label="Platform" value={platform} />
          <Row label="Web bundle version" value={webVersion} />
          {native && <Row label="Native app version" value={native.version} />}
          {native && <Row label="Native build number" value={native.build} />}
          {native && <Row label="Bundle identifier" value={native.id} />}
          <Row label="Build commit" value={buildCommit} />
          <Row label="Built at" value={formattedBuildTime} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="outline" onClick={copyAll} className="rounded-2xl border-slate-200/80 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/[0.06]">
            <Copy className="mr-2 size-4" /> Copy details
          </Button>
          <Button onClick={() => location.reload()} className="rounded-2xl border-0 font-bold text-slate-950" style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}>
            <RefreshCw className="mr-2 size-4" /> Reload
          </Button>
        </div>

        {!isNative && (
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Running in a browser. Native version and build number appear only inside the installed mobile app.
          </p>
        )}
      </section>
    </div>
  )
}
