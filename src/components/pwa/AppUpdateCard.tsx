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

  if (!hasUpdate || !release) return null

  const sizeMb = release.file_size ? (release.file_size / 1024 / 1024).toFixed(1) : null

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const { data, error } = await supabase.storage
        .from('app-releases')
        .createSignedUrl(release.file_path, 60 * 10, { download: true })
      if (error || !data?.signedUrl) {
        toast.error('Could not generate download link. Please try again.')
        return
      }
      await openExternal(data.signedUrl)
      toast.success(
        platform === 'ios'
          ? 'Opening installer…'
          : 'Download started. Check your notifications to install.',
      )
      setModalOpen(false)
    } catch (e) {
      toast.error('Download failed. Please try again.')
    } finally {
      // Keep the spinner briefly so the tap feels responsive, then reset.
      setTimeout(() => setDownloading(false), 800)
    }
  }

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
      </section>
      {modal}
    </>
  )
}

export default AppUpdateCard
