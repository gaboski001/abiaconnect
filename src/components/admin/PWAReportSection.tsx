import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Row = {
  id: string
  user_id: string | null
  event: string
  platform: string | null
  user_agent: string | null
  created_at: string
}

type PlatformData = {
  platform: string
  attempts: number
  accepted: number
  dismissed: number
  successRate: number
}

const PLATFORM_ORDER = ['android', 'ios', 'desktop']
const PLATFORM_LABELS: Record<string, string> = {
  android: 'Android',
  ios: 'iOS Safari',
  desktop: 'Desktop',
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

  const platformData: PlatformData[] = useMemo(() => {
    const perPlatform: Record<string, { attempts: number; accepted: number; dismissed: number }> =
      {}
    for (const r of rows) {
      const p = r.platform ?? 'unknown'
      if (!perPlatform[p]) perPlatform[p] = { attempts: 0, accepted: 0, dismissed: 0 }
      if (r.event === 'prompt_shown' || r.event === 'manual_click') {
        perPlatform[p].attempts += 1
      }
      if (r.event === 'accepted' || r.event === 'installed') {
        perPlatform[p].accepted += 1
      }
      if (r.event === 'dismissed') {
        perPlatform[p].dismissed += 1
      }
    }

    return PLATFORM_ORDER.map((key) => {
      const d = perPlatform[key] ?? { attempts: 0, accepted: 0, dismissed: 0 }
      const rate = d.attempts > 0 ? Number(((d.accepted / d.attempts) * 100).toFixed(1)) : 0
      return {
        platform: PLATFORM_LABELS[key],
        attempts: d.attempts,
        accepted: d.accepted,
        dismissed: d.dismissed,
        successRate: rate,
      }
    })
  }, [rows])

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
      '',
      `Platform Breakdown,,,,`,
      `Platform,Attempts,Accepted,Dismissed,Success Rate (%)`,
      ...platformData.map(
        (p) => `${p.platform},${p.attempts},${p.accepted},${p.dismissed},${p.successRate}`,
      ),
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
    <section className="rounded-2xl border bg-card p-5 space-y-5">
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

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Platform Breakdown — Attempts, Accepted &amp; Dismissed
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platformData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                itemStyle={{ color: 'var(--foreground)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="attempts" name="Attempts" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accepted" name="Accepted" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dismissed" name="Dismissed" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Platform Breakdown — Success Rate (%)
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platformData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                itemStyle={{ color: 'var(--foreground)' }}
                formatter={(value: number) => [`${value}%`, 'Success Rate']}
              />
              <Bar dataKey="successRate" name="Success Rate" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
