import { useEffect, useState } from 'react'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSiteLogo } from '@/hooks/useSiteLogo'
import { cn } from '@/lib/utils'

/**
 * Site logo for headers and menus. Renders the real logo immediately on
 * repeat visits (cached), an empty slot of the same size while it is still
 * loading (never a placeholder icon), and the site name only when no logo
 * is configured or the image fails.
 */
export function SiteLogo({
  className,
  imageClassName,
  nameFallback = true,
}: {
  className?: string
  imageClassName?: string
  /** Show the site name when there is no logo; false keeps it screen-reader only. */
  nameFallback?: boolean
}) {
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'
  const { url, status } = useSiteLogo()
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [url])

  if (status === 'ready' && url && !failed) {
    return (
      <img
        src={url}
        alt={siteName}
        onError={() => setFailed(true)}
        decoding="async"
        className={cn('h-9 w-auto max-w-[170px] object-contain', imageClassName)}
      />
    )
  }

  if (status === 'loading') {
    // Reserve the space so the header doesn't jump when the logo arrives.
    return <span className={cn('block h-9 w-24', className)} aria-hidden />
  }

  if (!nameFallback) return <span className="sr-only">{siteName}</span>

  return (
    <span className={cn('text-base font-bold tracking-tight text-foreground', className)}>{siteName}</span>
  )
}

export default SiteLogo
