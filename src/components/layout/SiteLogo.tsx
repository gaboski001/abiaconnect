import { useEffect, useState } from 'react'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { GOLD_GRADIENT } from '@/lib/mobileBrand'
import { cn } from '@/lib/utils'

/**
 * Site logo for headers and menus. Shows the uploaded logo, or a branded
 * monogram + site name when there is no logo or it fails to load, so the
 * header never renders an empty gap.
 */
export function SiteLogo({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  const { settings } = useSiteSettings()
  const siteName = settings.site_name || 'AbiaConnect'
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [logoUrl])

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={siteName}
        onError={() => setFailed(true)}
        className={cn('h-9 w-auto max-w-[170px] object-contain', imageClassName)}
      />
    )
  }

  const initials =
    siteName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AC'

  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className="flex size-9 items-center justify-center rounded-xl text-xs font-black text-slate-950 shadow-sm"
        style={{ backgroundImage: GOLD_GRADIENT }}
        aria-hidden
      >
        {initials}
      </span>
      <span className="text-base font-bold tracking-tight text-foreground">{siteName}</span>
    </span>
  )
}

export default SiteLogo
