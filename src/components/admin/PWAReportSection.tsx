import { useQuery } from '@tanstack/react-query'
import { Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

type Row = {
  id: string
  user_id: string | null
  event: string
  platform: string | null
  user_agent: string | null
  created_at: string
}

export default function PWAReportSection() {
  const q = useQuery({
    queryKey: ['pwa-install-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pwa_install_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) throw error
      return (data ?? []) as Row[]
    },
  })

  const rows = q.data ?? []
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.event] = (acc[r.event] ?? 0) + 1
    return acc
  }, {})
  const shown = counts['prompt_shown'] ?? 0
  const clicks = counts['manual_click'] ?? 0
  const accepted = (counts['accepted'] ?? 0) + (counts['installed'] ?? 0)
  const dismissed = counts['dismissed'] ?? 0
  const attempts = shown + clicks
  const successRate = attempts > 0 ? ((accepted / attempts) * 100).toFixed(1) : '0.0'

  const download = () => {
    if (rows.length === 0) {
      toast.info('No PWA install events recorded yet.')
      return
    }
    const header = ['created_at', 'event', 'platform', 'user_id', 'user_agent']
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        header
          .map((k) => {
            const v = (r as any)[k] ?? ''
            const s = String(v).replace(/"/g, '""')
            return `"${s}"`
          })
          .join(','),
      ),
      '',
      `Summary,,,,`,
      `Prompts shown,${shown},,,`,
      `Manual clicks,${clicks},,,`,
      `Accepted/Installed,${accepted},,,`,
      `Dismissed,${dismissed},,,`,
      `Success rate (%),${successRate},,,`,
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pwa-install-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">PWA Install Report</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Prompts shown" value={shown} />
        <Stat label="Manual clicks" value={clicks} />
        <Stat label="Accepted" value={accepted} />
        <Stat label="Dismissed" value={dismissed} />
        <Stat label="Success rate" value={`${successRate}%`} />
      </div>

      <Button onClick={download} disabled={q.isLoading}>
        <Download className="h-4 w-4 mr-2" />
        Download CSV Report
      </Button>
      <p className="text-xs text-muted-foreground">
        Report includes up to the last 5,000 install events.
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
