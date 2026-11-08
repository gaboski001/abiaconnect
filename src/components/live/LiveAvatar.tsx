import { useEffect, useState } from 'react'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { cn } from '@/lib/utils'

/** A member's picture in Live. Saved pictures are private paths, so they are signed first; the first letter shows otherwise. */
export function LiveAvatar({ path, name, className }: { path: string | null | undefined; name: string; className?: string }) {
  const src = useSignedUrl(path, 'avatars')
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])

  if (src && !broken) {
    return <img src={src} alt="" onError={() => setBroken(true)} className={cn('shrink-0 rounded-full object-cover', className)} />
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary', className)}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}
