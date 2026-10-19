import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sprout } from 'lucide-react'
import { loose } from '@/lib/journey'
import { cn } from '@/lib/utils'

interface Funnel {
  joined: number
  welcomed: number
  acted_first_day: number
  finished_steps: number
  came_back_week_2: number
  old_enough_for_week_2: number
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/**
 * How new members are settling in: did they get through the welcome, do
 * something on day one, finish their first 5 steps, and come back in week two?
 */
export function NewcomerFunnelSection() {
  const [days, setDays] = useState(30)
  const funnel = useQuery({
    queryKey: ['newcomer-funnel', days],
    queryFn: async () => {
      const { data, error } = await loose.rpc('newcomer_funnel', { _days: days })
      if (error) throw new Error(error.message)
      return data as Funnel
    },
  })
  const f = funnel.data
  const rows = f
    ? [
        { label: 'Joined', value: f.joined, of: f.joined, hint: 'New accounts in this period' },
        { label: 'Finished the welcome', value: f.welcomed, of: f.joined, hint: 'Picked interests and joined groups' },
        { label: 'Took part on day one', value: f.acted_first_day, of: f.joined, hint: 'Posted, replied or voted within 24 hours' },
        { label: 'Finished the 5 steps', value: f.finished_steps, of: f.joined, hint: 'Earned the New Abian badge' },
        { label: 'Came back in week two', value: f.came_back_week_2, of: f.old_enough_for_week_2, hint: 'Of members who joined over 7 days ago' },
      ]
    : []

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sprout className="h-5 w-5 text-primary" /> How new members are settling in
        </h2>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn('rounded-md px-3 py-1', days === d ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground')}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>
      {funnel.isLoading ? (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-muted" />
      ) : funnel.isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          These numbers appear once the newcomer database update has been applied.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="tabular-nums">
                  <strong>{row.value.toLocaleString()}</strong>
                  {row.label !== 'Joined' ? <span className="text-muted-foreground"> · {pct(row.value, row.of)}%</span> : null}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${row.label === 'Joined' ? 100 : pct(row.value, row.of)}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
