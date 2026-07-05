import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { CheckCircle2, Download, FileText, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'
import { ChangelogModal } from './ChangelogModal'

type Variant = 'premium' | 'plain'

interface AppUpdateCardProps {
  variant?: Variant
  className?: string
}

/**
 * Opens a URL in the OS-level browser/download manager. On Capacitor WebViews,
 * assigning window.location.href just navigates the app view instead of
 * triggering the system download for APK/IPA — we must hand it off to the OS.
 */
async function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    // Prefer @capacitor/browser if the app has it installed.
    try {
      const mod = '@capacitor/' + 'browser'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m: any = await (new Function('x', 'return import(x)'))(mod)
      if (m?.Browser?.open) {
        await m.Browser.open({ url })
        return
      }
    } catch {
      /* fall through */
    }
    // Capacitor intercepts window.open with '_system' and hands the URL to the OS.
    try {
      const w = window.open(url, '_system')
      if (w) return
    } catch {
      /* fall through */
    }
  }
  // Web fallback / last resort.
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Renders a nice "update available" card on native platforms only, and only
 * when the installed native version is older than the latest published release.
 * Auto-hides once the user is on the latest version.
 */
export function AppUpdateCard({ variant = 'premium', className }: AppUpdateCardProps) {
  const { release, currentVersion, hasUpdate, platform, isLoading } = useAppUpdate()
  const [modalOpen, setModalOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  type InstallStatus = 'idle' | 'preparing' | 'started' | 'failed'
  const [status, setStatus] = useState<InstallStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // When the app regains focus after the OS installer/browser handoff, the
  // useAppUpdate query will refetch and hide this card if the user actually
  // installed the new version. Until then, keep showing "started".
  useEffect(() => {
    if (status !== 'started') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // Just nudge the UI — the outer query auto-refreshes on its own.
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [status])

  if (!hasUpdate || !release) return null

  const sizeMb = release.file_size ? (release.file_size / 1024 / 1024).toFixed(1) : null

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    setStatus('preparing')
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.storage
        .from('app-releases')
        .createSignedUrl(release.file_path, 60 * 10, { download: true })
      if (error || !data?.signedUrl) {
        setStatus('failed')
        setErrorMsg('Could not generate download link.')
        toast.error('Could not generate download link. Please try again.')
        return
      }
      await openExternal(data.signedUrl)
      setStatus('started')
      toast.success(
        platform === 'ios'
          ? 'Opening installer…'
          : 'Download started. Check your notifications to install.',
      )
      setModalOpen(false)
    } catch (e) {
      setStatus('failed')
      setErrorMsg(e instanceof Error ? e.message : 'Download failed.')
      toast.error('Download failed. Please try again.')
    } finally {
      setTimeout(() => setDownloading(false), 800)
    }
  }

  const statusStrip = status === 'idle' ? null : (
    <InstallStatusStrip
      status={status}
      platform={platform}
      version={release.version}
      errorMsg={errorMsg}
      onRetry={download}
      tone={variant === 'premium' ? 'dark' : 'light'}
    />
  )


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
      onDownload={download}
      downloading={downloading}
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
              <p className="text-sm font-semibold">
                Update available — v{release.version}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You're on v{currentVersion ?? '?'} · {platform === 'ios' ? 'iOS' : 'Android'}
                {sizeMb ? ` · ${sizeMb} MB` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={download} disabled={downloading} className="gap-2">
                  {downloading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Preparing…
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" /> Download update
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModalOpen(true)}
                  className="gap-2"
                >
                  <FileText className="size-3.5" /> What's new
                </Button>
              </div>
              {statusStrip}
            </div>
          </div>
        </div>
        {modal}
      </>
    )
  }

  // Premium (mobile dashboard) variant
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
            onClick={download}
            disabled={downloading}
            className="h-11 flex-1 gap-2 rounded-2xl border-0 text-sm font-black text-[#0B1220] active:scale-[0.98] transition-transform"
            style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
          >
            {downloading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Preparing…
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
        {statusStrip}
      </section>
      {modal}
    </>
  )
}

interface InstallStatusStripProps {
  status: 'preparing' | 'started' | 'failed'
  platform: 'android' | 'ios' | 'web'
  version: string
  errorMsg: string | null
  onRetry: () => void
  tone: 'dark' | 'light'
}

function InstallStatusStrip({ status, platform, version, errorMsg, onRetry, tone }: InstallStatusStripProps) {
  const dark = tone === 'dark'
  const base = dark
    ? 'mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5'
    : 'mt-3 rounded-xl border px-3 py-2.5'

  if (status === 'preparing') {
    const cls = dark ? `${base}` : `${base} border-muted bg-muted/40`
    return (
      <div className={`${cls} flex items-center gap-2`} role="status" aria-live="polite">
        <Loader2 className={`size-4 animate-spin ${dark ? 'text-[#F8C301]' : 'text-amber-600'}`} />
        <p className={`text-xs ${dark ? 'text-white/80' : 'text-foreground'}`}>
          Preparing secure download…
        </p>
      </div>
    )
  }

  if (status === 'started') {
    const cls = dark
      ? `${base} border-emerald-400/25 bg-emerald-400/10`
      : `${base} border-emerald-500/30 bg-emerald-500/5`
    return (
      <div className={`${cls} flex items-start gap-2`} role="status" aria-live="polite">
        <CheckCircle2 className={`size-4 mt-0.5 ${dark ? 'text-emerald-300' : 'text-emerald-600'}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold ${dark ? 'text-emerald-100' : 'text-emerald-800'}`}>
            {platform === 'ios' ? `Installer opened for v${version}` : `Downloading v${version}…`}
          </p>
          <p className={`mt-0.5 text-[11px] leading-snug ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
            {platform === 'ios'
              ? 'Follow the on-screen steps to install. This card will disappear once the new version is running.'
              : 'Open the notification when it finishes and tap Install. This card will disappear once the new version is running.'}
          </p>
        </div>
      </div>
    )
  }

  // failed
  const cls = dark
    ? `${base} border-red-400/30 bg-red-500/10`
    : `${base} border-red-500/40 bg-red-500/5`
  return (
    <div className={`${cls} flex items-start gap-2`} role="alert">
      <XCircle className={`size-4 mt-0.5 ${dark ? 'text-red-300' : 'text-red-600'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${dark ? 'text-red-100' : 'text-red-800'}`}>
          Update failed
        </p>
        <p className={`mt-0.5 text-[11px] leading-snug ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
          {errorMsg ?? 'Something went wrong preparing the download.'}
        </p>
      </div>
      <Button
        size="sm"
        variant={dark ? 'outline' : 'secondary'}
        onClick={onRetry}
        className={`h-7 gap-1 px-2 text-[11px] ${dark ? 'border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white' : ''}`}
      >
        <RefreshCw className="size-3" /> Retry
      </Button>
    </div>
  )
}

export default AppUpdateCard
