import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileText, Loader2, Pause, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { useReleaseDownload, type DownloadState } from '@/hooks/useReleaseDownload'
import { GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'
import { ChangelogModal } from './ChangelogModal'

type Variant = 'premium' | 'plain'

interface AppUpdateCardProps {
  variant?: Variant
  className?: string
}

function formatBytes(n: number | null) {
  if (n == null) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatSpeed(bps: number | null) {
  if (!bps) return null
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

/**
 * Nice "update available" card. Only renders on native when the installed
 * version is older than the latest published release. When the user is on
 * the latest version, `hasUpdate` is false and the card is hidden.
 */
export function AppUpdateCard({ variant = 'premium', className }: AppUpdateCardProps) {
  const { release, currentVersion, hasUpdate, platform, isLoading } = useAppUpdate()
  const [modalOpen, setModalOpen] = useState(false)
  const { state, download, cancel, reset } = useReleaseDownload()

  // Auto-hide the transient "installing/done" states after the app regains
  // focus — the useAppUpdate query will refetch and unmount this card if the
  // new version is now installed.
  useEffect(() => {
    if (state.status !== 'installing') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') reset()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [state.status, reset])

  if (!hasUpdate || !release) return null

  const sizeMb = release.file_size ? (release.file_size / 1024 / 1024).toFixed(1) : null

  const start = () =>
    download({
      filePath: release.file_path,
      version: release.version,
      platform,
      fileSize: release.file_size,
    })

  const busy = state.status === 'preparing' || state.status === 'downloading'
  const showStrip = state.status !== 'idle'

  const strip = showStrip ? (
    <ProgressStrip
      state={state}
      platform={platform}
      version={release.version}
      onCancel={cancel}
      onRetry={start}
      tone={variant === 'premium' ? 'dark' : 'light'}
    />
  ) : null

  const modal = (
    <ChangelogModal
      open={modalOpen}
      onOpenChange={setModalOpen}
      version={release.version}
      currentVersion={currentVersion}
      platform={platform}
      sizeMb={sizeMb}
      changelog={release.changelog}
      isLoading={isLoading}
      onDownload={start}
      downloading={busy}
    />
  )

  if (variant === 'plain') {
    return (
      <>
        <div className={`rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 ${className ?? ''}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <Sparkles className="size-5 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Update available — v{release.version}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You're on v{currentVersion ?? '?'} · {platform === 'ios' ? 'iOS' : 'Android'}
                {sizeMb ? ` · ${sizeMb} MB` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={start} disabled={busy} className="gap-2">
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {state.status === 'downloading' && state.progress != null
                        ? `${Math.round(state.progress * 100)}%`
                        : 'Preparing…'}
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" /> Download update
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setModalOpen(true)} className="gap-2">
                  <FileText className="size-3.5" /> What's new
                </Button>
              </div>
              {strip}
            </div>
          </div>
        </div>
        {modal}
      </>
    )
  }

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[2rem] border border-[#F8C301]/25 bg-[#0B1220] p-5 text-white shadow-xl ${className ?? ''}`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#F8C301]/20 blur-[70px]" />
        <div className="relative flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
          >
            <Sparkles className="size-5 text-[#0B1220]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F8C301]">
              App update ready
            </p>
            <h3 className="mt-0.5 text-base font-black leading-tight">
              Version {release.version} available
            </h3>
            <p className="mt-1 text-xs text-white/60">
              You're on v{currentVersion ?? '?'} · {platform === 'ios' ? 'iOS' : 'Android'}
              {sizeMb ? ` · ${sizeMb} MB` : ''}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex gap-2">
          <Button
            onClick={start}
            disabled={busy}
            className="h-11 flex-1 gap-2 rounded-2xl border-0 text-sm font-black text-[#0B1220] active:scale-[0.98] transition-transform"
            style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {state.status === 'downloading' && state.progress != null
                  ? `Downloading ${Math.round(state.progress * 100)}%`
                  : 'Preparing…'}
              </>
            ) : (
              <>
                <Download className="size-4 stroke-[3]" /> Update to v{release.version}
              </>
            )}
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            variant="outline"
            className="h-11 gap-2 rounded-2xl border-white/15 bg-white/5 px-4 text-xs font-bold text-white hover:bg-white/10 hover:text-white"
          >
            <FileText className="size-4" /> Notes
          </Button>
        </div>
        {strip}
      </section>
      {modal}
    </>
  )
}

interface ProgressStripProps {
  state: DownloadState
  platform: 'android' | 'ios' | 'web'
  version: string
  onCancel: () => void
  onRetry: () => void
  tone: 'dark' | 'light'
}

function ProgressStrip({ state, platform, version, onCancel, onRetry, tone }: ProgressStripProps) {
  const dark = tone === 'dark'
  const wrap = dark
    ? 'mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3'
    : 'mt-3 rounded-xl border border-muted bg-muted/40 px-3 py-3'

  if (state.status === 'preparing') {
    return (
      <div className={`${wrap} flex items-center gap-2`} role="status" aria-live="polite">
        <Loader2 className={`size-4 animate-spin ${dark ? 'text-[#F8C301]' : 'text-amber-600'}`} />
        <p className={`text-xs ${dark ? 'text-white/80' : 'text-foreground'}`}>
          Preparing secure download…
        </p>
      </div>
    )
  }

  if (state.status === 'downloading') {
    const pct = state.progress != null ? Math.round(state.progress * 100) : null
    const loadedTxt = formatBytes(state.loaded)
    const totalTxt = formatBytes(state.total)
    const speed = formatSpeed(state.speed)
    return (
      <div className={wrap} role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-foreground'}`}>
            {pct != null ? `Downloading v${version} — ${pct}%` : `Downloading v${version}…`}
          </p>
          <button
            onClick={onCancel}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              dark ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pause className="size-3" /> Cancel
          </button>
        </div>
        <div
          className={`mt-2 h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-muted'}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
        >
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{
              width: pct != null ? `${pct}%` : '35%',
              backgroundImage: GOLD_GRADIENT,
              animation: pct == null ? 'indeterminate 1.4s ease-in-out infinite' : undefined,
            }}
          />
        </div>
        <p className={`mt-2 text-[11px] ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
          {loadedTxt}
          {totalTxt ? ` / ${totalTxt}` : ''}
          {speed ? ` · ${speed}` : ''}
        </p>
      </div>
    )
  }

  if (state.status === 'installing' || state.status === 'done') {
    const emerald = dark
      ? 'border-emerald-400/25 bg-emerald-400/10'
      : 'border-emerald-500/30 bg-emerald-500/5'
    return (
      <div className={`mt-3 rounded-2xl border px-3 py-3 ${emerald}`} role="status" aria-live="polite">
        <div className="flex items-start gap-2">
          <CheckCircle2 className={`size-4 mt-0.5 ${dark ? 'text-emerald-300' : 'text-emerald-600'}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold ${dark ? 'text-emerald-100' : 'text-emerald-800'}`}>
              {platform === 'ios' ? `Installer opened for v${version}` : `Ready to install v${version}`}
            </p>
            <p className={`mt-0.5 text-[11px] leading-snug ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
              {platform === 'ios'
                ? 'Follow the on-screen steps to install. This card disappears once the new version is running.'
                : platform === 'android'
                  ? 'Your device will prompt you to install. If you don\u2019t see it, check your notifications.'
                  : 'Check your downloads folder to open the file.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // failed
  const red = dark ? 'border-red-400/30 bg-red-500/10' : 'border-red-500/40 bg-red-500/5'
  return (
    <div className={`mt-3 rounded-2xl border px-3 py-3 ${red} flex items-start gap-2`} role="alert">
      <XCircle className={`size-4 mt-0.5 ${dark ? 'text-red-300' : 'text-red-600'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${dark ? 'text-red-100' : 'text-red-800'}`}>
          Update failed
        </p>
        <p className={`mt-0.5 text-[11px] leading-snug ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
          {state.error ?? 'Something went wrong preparing the download.'}
        </p>
      </div>
      <Button
        size="sm"
        variant={dark ? 'outline' : 'secondary'}
        onClick={onRetry}
        className={`h-7 gap-1 px-2 text-[11px] ${
          dark ? 'border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white' : ''
        }`}
      >
        <RefreshCw className="size-3" /> Retry
      </Button>
    </div>
  )
}

export default AppUpdateCard
