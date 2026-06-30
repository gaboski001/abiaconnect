import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Apple, Smartphone, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from '@/lib/toast'

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  file_size: number | null
  changelog: string | null
  created_at: string
}

export function NativeAppDownload() {
  const [openId, setOpenId] = useState<string | null>(null)

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

  const download = async (r: Release) => {
    const { data, error } = await supabase.storage
      .from('app-releases')
      .createSignedUrl(r.file_path, 60 * 10, { download: true })
    if (error || !data?.signedUrl) return toast.error('Could not generate download link')
    window.location.href = data.signedUrl
  }

  if (q.isLoading || !q.data?.length) return null

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Native app download</p>
      <div className="space-y-2">
        {q.data.map((r) => {
          const open = openId === r.id
          return (
            <div key={r.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {r.platform === 'ios' ? <Apple className="size-4" /> : <Smartphone className="size-4" />}
                  <span className="text-sm font-medium">
                    {r.platform === 'ios' ? 'iOS' : 'Android'} v{r.version}
                  </span>
                  {r.file_size ? (
                    <span className="text-xs text-muted-foreground">({(r.file_size / 1024 / 1024).toFixed(1)} MB)</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  {r.changelog && (
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(open ? null : r.id)} className="gap-1">
                      What's new
                      {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => download(r)} className="gap-2">
                    <Download className="size-3.5" /> Download
                  </Button>
                </div>
              </div>
              {open && r.changelog && (
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted/40 rounded p-2 max-h-48 overflow-auto">{r.changelog}</pre>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Android: open the APK and tap Install. iOS: install via TestFlight or signed IPA.
      </p>
    </div>
  )
}
