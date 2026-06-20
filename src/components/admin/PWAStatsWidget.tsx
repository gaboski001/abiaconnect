import { useQuery } from '@tanstack/react-query'
import { Download, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function PWAStatsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['pwa-stats-widget'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pwa_install_events')
        .select('event, platform')
        .limit(5000)
      if (error) throw error
      const rows = data ?? []
      const downloadClicks = rows.filter((r) => r.event === 'manual_click').length
      const iosShown = rows.filter(
        (r) => r.event === 'ios_help_shown' && r.platform === 'ios'
      ).length
      const iosCompleted = rows.filter(
        (r) => r.event === 'ios_help_completed' && r.platform === 'ios'
      ).length
      const iosRate = iosShown > 0 ? Math.round((iosCompleted / iosShown) * 100) : 0
      return { downloadClicks, iosShown, iosCompleted, iosRate }
    },
    staleTime: 60_000,
  })

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">PWA Installs</h3>
        <Smartphone className="size-4 text-muted-foreground" />
      </div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Download className="size-3" /> Download clicks
            </div>
            <div className="text-2xl font-bold">{data?.downloadClicks ?? 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">iOS completion</div>
            <div className="text-2xl font-bold">{data?.iosRate ?? 0}%</div>
            <div className="text-[10px] text-muted-foreground">
              {data?.iosCompleted ?? 0}/{data?.iosShown ?? 0} completed
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
