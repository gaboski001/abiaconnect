import { useState } from 'react'
import { Download, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { GOLD_GRADIENT, GOLD_SHADOW } from '@/lib/mobileBrand'

type Variant = 'premium' | 'plain'

interface AppUpdateCardProps {
  variant?: Variant
  className?: string
}

/**
 * Renders a nice "update available" card on native platforms only, and only
 * when the installed native version is older than the latest published release.
 * Auto-hides once the user is on the latest version.
 */
export function AppUpdateCard({ variant = 'premium', className }: AppUpdateCardProps) {
  const { release, currentVersion, hasUpdate, platform } = useAppUpdate()
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (!hasUpdate || !release) return null

  const sizeMb = release.file_size ? (release.file_size / 1024 / 1024).toFixed(1) : null

  const download = async () => {
    setDownloading(true)
    try {
      const { data, error } = await supabase.storage
        .from('app-releases')
        .createSignedUrl(release.file_path, 60 * 10, { download: true })
      if (error || !data?.signedUrl) {
        toast.error('Could not generate download link')
        return
      }
      window.location.href = data.signedUrl
    } finally {
      setDownloading(false)
    }
  }

  if (variant === 'plain') {
    return (
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
            {release.changelog && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                What's new
                {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            )}
            {expanded && release.changelog && (
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border bg-muted/40 p-2 text-xs text-muted-foreground max-h-56 overflow-auto">
                {release.changelog}
              </pre>
            )}
            <Button
              size="sm"
              onClick={download}
              disabled={downloading}
              className="mt-3 gap-2"
            >
              <Download className="size-3.5" />
              {downloading ? 'Preparing…' : 'Download update'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Premium (mobile dashboard) variant
  return (
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

          {release.changelog && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[#F8C301]"
              aria-expanded={expanded}
            >
              {expanded ? 'Hide notes' : "What's new"}
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          )}
          {expanded && release.changelog && (
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-white/80">
              {release.changelog}
            </pre>
          )}
        </div>
      </div>

      <Button
        onClick={download}
        disabled={downloading}
        className="relative mt-4 h-11 w-full gap-2 rounded-2xl border-0 text-sm font-black text-[#0B1220] active:scale-[0.98] transition-transform"
        style={{ backgroundImage: GOLD_GRADIENT, boxShadow: GOLD_SHADOW }}
      >
        <Download className="size-4 stroke-[3]" />
        {downloading ? 'Preparing download…' : `Update to v${release.version}`}
      </Button>
    </section>
  )
}

export default AppUpdateCard
