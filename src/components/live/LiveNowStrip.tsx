import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useLiveRooms, useLiveStatus } from '@/lib/live'
import { cn } from '@/lib/utils'

/** Rooms live right now, on the home page. Shows nothing when no one is live. */
export function LiveNowStrip({ className }: { className?: string }) {
  const status = useLiveStatus()
  const rooms = useLiveRooms(status.data?.allowed === true)
  const list = rooms.data ?? []
  const canHost = status.data?.allowed === true && !status.data.host_blocker
  if (!list.length && !canHost) return null

  return (
    <section className={cn('space-y-2', className)} aria-label="Live now">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
          <span className="size-2 animate-pulse rounded-full bg-rose-600" /> Live now
        </h2>
        <Link to="/live" className="text-[13px] font-medium text-primary">
          {canHost ? 'Go live' : 'See all'}
        </Link>
      </div>
      {list.length ? (
        <ul className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {list.map((r) => (
            <li key={r.id} className="w-52 shrink-0">
              <Link to={`/live/${r.id}`} className="flex items-center gap-2.5 rounded-2xl border bg-card p-3 active:bg-muted">
                {r.host_avatar ? (
                  <img src={r.host_avatar} alt="" className="size-10 shrink-0 rounded-full object-cover ring-2 ring-rose-600" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-600/10 text-rose-600 ring-2 ring-rose-600">
                    <Radio className="size-4" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{r.title}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {r.host_name} · {r.listening} in
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No one is live right now. Start a room and talk with your group.</p>
      )}
    </section>
  )
}
