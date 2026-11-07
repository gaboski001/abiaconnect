import { Briefcase, Handshake, Heart, Sparkles, UserPlus, Users, Wrench, type LucideIcon } from 'lucide-react'
import { LOOKING_FOR_LABELS, type LookingFor } from '@/lib/relationship'
import { cn } from '@/lib/utils'

const STYLE: Record<LookingFor, { icon: LucideIcon; tone: string }> = {
  work: { icon: Briefcase, tone: 'bg-sky-700 text-white' },
  hiring: { icon: UserPlus, tone: 'bg-violet-700 text-white' },
  networking: { icon: Handshake, tone: 'bg-emerald-700 text-white' },
  services: { icon: Wrench, tone: 'bg-amber-600 text-white' },
  friendship: { icon: Users, tone: 'bg-teal-700 text-white' },
  dating: { icon: Heart, tone: 'bg-rose-600 text-white' },
  serious: { icon: Heart, tone: 'bg-rose-600 text-white' },
  marriage: { icon: Heart, tone: 'bg-rose-600 text-white' },
}

/** Shows at a glance why a member is on Connect. */
export function ReasonBadge({ reason, className }: { reason: LookingFor | null | undefined; className?: string }) {
  const style = reason ? STYLE[reason] : null
  const Icon = style?.icon ?? Sparkles
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        style?.tone ?? 'bg-slate-600 text-white',
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{reason ? LOOKING_FOR_LABELS[reason] : 'Open to connect'}</span>
    </span>
  )
}
