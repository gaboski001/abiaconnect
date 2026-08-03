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
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
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
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const isNative = Capacitor.isNativePlatform()

  const q = useQuery({
    queryKey: ['app-releases-public'],
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

  // Hide the download prompt if running inside the native app itself
  if (isNative) return null

  // Signed-in users who have already opened the native app get their profile
  // stamped with `native_app_installed_at`. Hide the download prompt for them.
  if (user && profileLoading) return null
  if (user && (profile as { native_app_installed_at?: string | null } | null)?.native_app_installed_at) {
    return null
  }

  if (q.isLoading || !q.data?.length) return null

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Native app download</p>
      <div className="space-y-2">
        {q.data.map((r) => (
          <DownloadRow key={r.id} r={r} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Android: open the APK and tap Install. iOS: install via TestFlight or a signed IPA.
      </p>
    </div>
  )
}
