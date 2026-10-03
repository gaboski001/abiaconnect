import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Apple,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react'
import { useReleaseDownload } from '@/hooks/useReleaseDownload'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { AppStoreBadge, GooglePlayBadge, safeStoreUrl } from './StoreBadges'
import { Capacitor } from '@capacitor/core'

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  file_size: number | null
  changelog: string | null
  created_at: string
}

function fmtMB(n: number) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function DownloadRow({ r }: { r: Release }) {
  const [open, setOpen] = useState(false)
  const { state, download, cancel, reset } = useReleaseDownload()
  const busy = state.status === 'preparing' || state.status === 'downloading'
  const pct = state.progress != null ? Math.round(state.progress * 100) : null

  const start = () =>
    download({
      filePath: r.file_path,
      version: r.version,
      platform: r.platform,
      fileSize: r.file_size,
    })

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {r.platform === 'ios' ? <Apple className="size-4" /> : <Smartphone className="size-4" />}
          <span className="text-sm font-medium">
            {r.platform === 'ios' ? 'iOS' : 'Android'} v{r.version}
          </span>
          {r.file_size ? (
            <span className="text-xs text-muted-foreground">({fmtMB(r.file_size)})</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {r.changelog && (
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} className="gap-1">
              What's new
              {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
          )}
          {busy ? (
            <Button size="sm" variant="outline" onClick={cancel} className="gap-2">
              <X className="size-3.5" /> Cancel
            </Button>
          ) : (
            <Button size="sm" onClick={start} className="gap-2">
              <Download className="size-3.5" /> Download
            </Button>
          )}
        </div>
      </div>

      {state.status !== 'idle' && (
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          {state.status === 'preparing' && (
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="size-3.5 animate-spin text-amber-600" /> Preparing secure download…
            </div>
          )}
          {state.status === 'downloading' && (
            <>
              <div className="flex items-center justify-between text-xs font-medium">
                <span>{pct != null ? `Downloading ${pct}%` : 'Downloading…'}</span>
                <span className="text-muted-foreground">
                  {fmtMB(state.loaded)}
                  {state.total ? ` / ${fmtMB(state.total)}` : ''}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct ?? undefined}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: pct != null ? `${pct}%` : '35%' }}
                />
              </div>
            </>
          )}
          {(state.status === 'installing' || state.status === 'done') && (
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="size-4 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-emerald-800">Download ready</p>
                <p className="text-muted-foreground mt-0.5">
                  {r.platform === 'android'
                    ? 'Open the APK from your downloads and tap Install. On Android you may need to allow install from this browser.'
                    : 'Open the file to install via TestFlight or a signed IPA.'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={reset} className="h-7 px-2 text-[11px]">
                Done
              </Button>
            </div>
          )}
          {state.status === 'failed' && (
            <div className="flex items-start gap-2 text-xs">
              <XCircle className="size-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">Download failed</p>
                <p className="text-muted-foreground mt-0.5">
                  {state.error ?? 'Please try again.'}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={start} className="h-7 px-2 text-[11px]">
                Retry
              </Button>
            </div>
          )}
        </div>
      )}

      {open && r.changelog && (
        <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/40 rounded p-2 max-h-48 overflow-auto">
          {r.changelog}
        </pre>
      )}
    </div>
  )
}

export function NativeAppDownload() {
  const isNative = Capacitor.isNativePlatform()
  const { settings } = useSiteSettings()
  const playUrl = safeStoreUrl(settings.play_store_url, 'play')
  const appleUrl = safeStoreUrl(settings.app_store_url, 'apple')

  // Latest admin-uploaded release per platform (Admin -> Native Apps).
  const q = useQuery({
    queryKey: ['app-releases-public'],
    enabled: !isNative,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('id, platform, version, file_path, file_size, changelog, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      const latest: Record<string, Release> = {}
      for (const r of (data ?? []) as Release[]) {
        if (!latest[r.platform]) latest[r.platform] = r
      }
      return Object.values(latest)
    },
  })

  // Inside the app itself, updates are offered by UpdateAvailablePrompt.
  if (isNative) return null

  // Direct downloads are offered only where the store isn't available yet.
  const direct = (q.data ?? []).filter((r) => (r.platform === 'android' ? !playUrl : !appleUrl))

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold">Get the AbiaConnect app</p>
        <p className="text-sm text-muted-foreground">
          Calls, instant notifications and a faster experience on your phone.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <GooglePlayBadge href={playUrl} />
        <AppStoreBadge href={appleUrl} />
      </div>

      {direct.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Or download directly</p>
          {direct.map((r) => (
            <DownloadRow key={r.id} r={r} />
          ))}
          <p className="text-xs text-muted-foreground">
            Android: open the downloaded APK and tap Install (you may need to allow installs from your browser). iOS:
            install via TestFlight or a signed IPA.
          </p>
        </div>
      )}
    </div>
  )
}
