import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'

const CHANGELOG_COLLAPSE_CHARS = 240
const CHANGELOG_COLLAPSE_LINES = 6
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'

const DISMISS_KEY = 'abia:update-prompt-dismissed-version'
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  changelog: string | null
}

// Compare semver-ish "1.2.3" strings. Returns >0 if a > b.
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

async function getCurrentNativeVersion(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = '@capacitor/' + 'app'
    const m: any = await (new Function('x', 'return import(x)'))(mod)
    const info = await m.App.getInfo()
    return info.version as string
  } catch {
    return null
  }
}

export function UpdateAvailablePrompt() {
  const [release, setRelease] = useState<Release | null>(null)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { isLong, preview } = useMemo(() => {
    const text = release?.changelog ?? ''
    const lines = text.split('\n')
    const long = text.length > CHANGELOG_COLLAPSE_CHARS || lines.length > CHANGELOG_COLLAPSE_LINES
    const previewText = long
      ? lines.slice(0, CHANGELOG_COLLAPSE_LINES).join('\n').slice(0, CHANGELOG_COLLAPSE_CHARS).trimEnd() + '…'
      : text
    return { isLong: long, preview: previewText }
  }, [release?.changelog])

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const isNative = Capacitor.isNativePlatform()
      const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web'

      // Web bundle update: detect via versioned build string changing on the server.
      // For web we rely on the existing PWA cleanup worker; for native we compare
      // against the latest published release.
      if (!isNative) {
        try {
          const res = await fetch('/version.json', { cache: 'no-store' })
          if (!res.ok) return
          const json = (await res.json()) as { version?: string }
          if (json.version && json.version !== __APP_VERSION__) {
            const dismissed = localStorage.getItem(DISMISS_KEY)
            if (dismissed === json.version) return
            if (cancelled) return
            toast('A new version is available', {
              description: 'Reload to get the latest improvements.',
              duration: 10000,
              action: {
                label: 'Reload',
                onClick: () => location.reload(),
              },
              onDismiss: () => localStorage.setItem(DISMISS_KEY, json.version!),
            })
          }
        } catch {
          /* version.json optional */
        }
        return
      }

      if (platform !== 'android' && platform !== 'ios') return
      const current = await getCurrentNativeVersion()
      if (!current) return

      const { data, error } = await supabase
        .from('app_releases')
        .select('id, platform, version, file_path, changelog')
        .eq('is_active', true)
        .eq('platform', platform)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error || !data || cancelled) return
      if (compareVersions(data.version, current) <= 0) return

      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed === data.version) return

      setRelease(data as Release)
      setOpen(true)
    }

    // Stagger initial check so it doesn't compete with first paint.
    const t = window.setTimeout(check, 6000)
    const interval = window.setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearTimeout(t)
      window.clearInterval(interval)
    }
  }, [])

  const dismiss = () => {
    if (release) localStorage.setItem(DISMISS_KEY, release.version)
    setOpen(false)
  }

  const download = async () => {
    if (!release) return
    const { data, error } = await supabase.storage
      .from('app-releases')
      .createSignedUrl(release.file_path, 60 * 10, { download: true })
    if (error || !data?.signedUrl) {
      toast.error('Could not generate download link')
      return
    }
    window.location.href = data.signedUrl
    dismiss()
  }

  if (!release) return null

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Update available — v{release.version}</DialogTitle>
          <DialogDescription className="text-center">
            A newer version of AbiaConnect is ready. Update now for the latest fixes and features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What's new in v{release.version}
          </p>
          {release.changelog ? (
            <>
              <pre
                className={`text-xs whitespace-pre-wrap text-foreground bg-muted/40 rounded p-3 border ${
                  expanded ? 'max-h-72 overflow-auto' : 'overflow-hidden'
                }`}
              >
                {expanded || !isLong ? release.changelog : preview}
              </pre>
              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs font-medium text-primary hover:underline"
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          ) : (
            <p className="text-xs italic text-muted-foreground bg-muted/40 rounded p-3 border">
              No release notes were provided for this update.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Button onClick={download} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Download update
          </Button>
          <Button variant="ghost" onClick={() => location.reload()} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload app
          </Button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateAvailablePrompt
