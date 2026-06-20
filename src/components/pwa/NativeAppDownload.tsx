import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Apple, Smartphone, Download } from 'lucide-react'
import { toast } from 'sonner'

type Release = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  file_size: number | null
  notes: string | null
  created_at: string
}

export function NativeAppDownload() {
  const q = useQuery({
    queryKey: ['app-releases-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('id, platform, version, file_path, file_size, notes, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      // latest per platform
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
    if (error || !data?.signedUrl) {
      toast.error('Could not generate download link')
      return
    }
    window.location.href = data.signedUrl
  }

  if (q.isLoading) return null
  if (!q.data?.length) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Native app download</p>
      <div className="flex flex-wrap gap-2">
        {q.data.map((r) => (
          <Button key={r.id} variant="outline" size="sm" onClick={() => download(r)} className="gap-2">
            {r.platform === 'ios' ? <Apple className="size-4" /> : <Smartphone className="size-4" />}
            <Download className="size-3.5" />
            {r.platform === 'ios' ? 'iOS' : 'Android'} v{r.version}
            {r.file_size ? <span className="text-xs text-muted-foreground">({(r.file_size / 1024 / 1024).toFixed(1)} MB)</span> : null}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Android: open the APK and tap Install. iOS: install via TestFlight or signed IPA.
      </p>
    </div>
  )
}
