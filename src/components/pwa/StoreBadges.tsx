import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/** Only links to the official stores are used (admins paste them in Site Settings). */
export function safeStoreUrl(url: string | null | undefined, store: 'play' | 'apple'): string | null {
  const v = (url ?? '').trim()
  if (!v) return null
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return null
    const host = u.hostname.toLowerCase()
    if (store === 'play' && host === 'play.google.com') return u.toString()
    if (store === 'apple' && (host === 'apps.apple.com' || host === 'itunes.apple.com')) return u.toString()
    return null
  } catch {
    return null
  }
}

const GooglePlayLogo = () => (
  <svg viewBox="0 0 24 24" className="size-7 shrink-0" aria-hidden>
    <path d="M3.6 1.8 13.4 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Z" fill="#00A0FF" />
    <path d="M3.6 1.8 16.7 9.3 13.4 12 3.6 1.8Z" fill="#00F076" />
    <path d="m16.7 9.3 3.7 2.1c.7.4.7.8 0 1.2l-3.7 2.1-3.3-2.7 3.3-2.7Z" fill="#FFD500" />
    <path d="M3.6 22.2 13.4 12l3.3 2.7L3.6 22.2Z" fill="#FF3A44" />
  </svg>
)

const AppleLogo = () => (
  <svg viewBox="0 0 24 24" className="size-7 shrink-0" fill="currentColor" aria-hidden>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09ZM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
)

function Badge({
  href,
  logo,
  small,
  big,
  storeName,
}: {
  href: string | null
  logo: React.ReactNode
  small: string
  big: string
  storeName: string
}) {
  const body = (
    <>
      {logo}
      <span className="flex flex-col items-start leading-none">
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-90">{small}</span>
        <span className="text-lg font-semibold tracking-tight">{big}</span>
      </span>
      {!href && (
        <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
          Coming soon
        </span>
      )}
    </>
  )
  const cls = cn(
    'relative inline-flex h-14 min-w-[11rem] items-center gap-2.5 rounded-xl border border-[#a6a6a6] bg-black px-4 text-white transition',
    href ? 'hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary' : 'opacity-70',
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`${small} ${big}`}>
        {body}
      </a>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      aria-label={`${big}: coming soon`}
      onClick={() => toast(`Coming soon to ${storeName}`, { description: 'We’ll let you know as soon as AbiaConnect is available there.' })}
    >
      {body}
    </button>
  )
}

export function GooglePlayBadge({ href }: { href: string | null }) {
  return <Badge href={href} logo={<GooglePlayLogo />} small="Get it on" big="Google Play" storeName="Google Play" />
}

export function AppStoreBadge({ href }: { href: string | null }) {
  return <Badge href={href} logo={<AppleLogo />} small="Download on the" big="App Store" storeName="the App Store" />
}
