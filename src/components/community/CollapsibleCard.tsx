import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const storageKey = (name: string) => `abia:card-folded:${name}`

function readFolded(name: string, version: string) {
  try {
    return localStorage.getItem(storageKey(name)) === version
  } catch {
    return false
  }
}

function saveFolded(name: string, version: string, folded: boolean) {
  try {
    if (folded) localStorage.setItem(storageKey(name), version)
    else localStorage.removeItem(storageKey(name))
  } catch {
    // Without storage the card still folds, it just opens again next visit.
  }
}

/**
 * A card a member can fold down to its title. The choice is remembered on this
 * device for this `version`, so a card about something new (a new poll, today's
 * question) opens again by itself.
 */
export function CollapsibleCard({
  name,
  version = '1',
  title,
  action,
  className,
  titleClassName,
  children,
}: {
  name: string
  version?: string
  title: ReactNode
  action?: ReactNode
  className?: string
  titleClassName?: string
  children: ReactNode
}) {
  const [folded, setFolded] = useState<{ version: string; value: boolean } | null>(null)
  const isFolded = folded?.version === version ? folded.value : readFolded(name, version)
  const toggle = () => {
    saveFolded(name, version, !isFolded)
    setFolded({ version, value: !isFolded })
  }
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} aria-expanded={!isFolded} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
          <span className={cn('flex min-w-0 items-center gap-2 text-[15px] font-bold text-foreground', titleClassName)}>{title}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isFolded && '-rotate-90')} aria-hidden />
        </button>
        {action}
      </div>
      {isFolded ? null : <div className="mt-3">{children}</div>}
    </section>
  )
}
