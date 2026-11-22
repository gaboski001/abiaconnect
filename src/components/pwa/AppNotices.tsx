import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, Smartphone, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { useProfile } from '@/hooks/useProfile'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import {
  ANDROID_RELEASE_NOTES,
  isAndroidBrowser,
  LATEST_ANDROID_RELEASE,
  playStoreLink,
  shouldOfferApp,
} from '@/lib/appRelease'
import { toast } from '@/lib/toast'

const GET_APP_KEY = 'abia:get-app-snoozed-at'
const UPDATE_KEY = 'abia:android-update-later'
const SITE_UPDATE_KEY = 'abia:site-update-seen'
/** "Later" on the app update brings it back after this long. */
const UPDATE_LATER_MS = 3 * 24 * 60 * 60 * 1000
const SITE_CHECK_MS = 30 * 60 * 1000

function readNumber(key: string) {
  try {
    return Number(localStorage.getItem(key)) || null
  } catch {
    return null
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the message just comes back next visit.
  }
}

/**
 * Android browser visitors: "Get the AbiaConnect app" with one tap to Google
 * Play. Never shown inside the app, on iPhone, or to members whose account
 * has opened the app before.
 */
function GetAppBanner() {
  const { user } = useAuth()
  const profile = useProfile()
  const { settings } = useSiteSettings()
  const [visible, setVisible] = useState(false)
  const native = Capacitor.isNativePlatform()
  const androidBrowser = typeof navigator !== 'undefined' && isAndroidBrowser(navigator.userAgent, native)
  // Wait for the account before deciding, so app owners never see a flash of it.
  const accountKnown = !user || !profile.isLoading
  const hasAppOnAccount = Boolean(
    (profile.data as { native_app_installed_at?: string | null } | null | undefined)?.native_app_installed_at,
  )

  useEffect(() => {
    if (!accountKnown) return
    if (!shouldOfferApp({ androidBrowser, hasAppOnAccount, snoozedAt: readNumber(GET_APP_KEY), now: Date.now() })) {
      setVisible(false)
      return
    }
    const t = window.setTimeout(() => setVisible(true), 3000)
    return () => window.clearTimeout(t)
  }, [accountKnown, androidBrowser, hasAppOnAccount])

  if (!visible) return null

  const snooze = () => {
    save(GET_APP_KEY, String(Date.now()))
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Get the AbiaConnect app"
      className="fixed inset-x-3 z-50 rounded-2xl border bg-card p-4 text-card-foreground shadow-2xl animate-in slide-in-from-bottom-4"
      style={{ bottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <button
        type="button"
        onClick={snooze}
        aria-label="Not now"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone className="size-6 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">Get the AbiaConnect app</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Free on Google Play. Voice and video calls, instant message alerts and a faster AbiaConnect.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button asChild className="flex-1 gap-2">
          <a href={playStoreLink(settings.play_store_url)} onClick={snooze} rel="noopener">
            <Download className="size-4" /> Get it on Google Play
          </a>
        </Button>
        <Button variant="ghost" onClick={snooze}>
          Not now
        </Button>
      </div>
    </div>
  )
}

/** Inside the Android app: a newer version is on Google Play. */
function AppUpdateDialog() {
  const { hasUpdate, platform, currentVersion } = useAppUpdate()
  const { settings } = useSiteSettings()
  const [open, setOpen] = useState(false)
  const latest = LATEST_ANDROID_RELEASE.version

  useEffect(() => {
    if (platform !== 'android' || !hasUpdate) return
    try {
      const later = JSON.parse(localStorage.getItem(UPDATE_KEY) ?? 'null') as { version?: string; at?: number } | null
      if (later?.version === latest && later.at && Date.now() - later.at < UPDATE_LATER_MS) return
    } catch {
      // Unreadable: just ask.
    }
    const t = window.setTimeout(() => setOpen(true), 4000)
    return () => window.clearTimeout(t)
  }, [platform, hasUpdate, latest])

  const later = () => {
    save(UPDATE_KEY, JSON.stringify({ version: latest, at: Date.now() }))
    setOpen(false)
  }

  const update = () => {
    later()
    // Leaves the app's web view and opens the Play Store app on the AbiaConnect page.
    window.location.href = playStoreLink(settings.play_store_url)
  }

  if (platform !== 'android' || !hasUpdate) return null

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : later())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Update available</DialogTitle>
          <DialogDescription className="text-center">
            Version {latest} of AbiaConnect is ready on Google Play. You have {currentVersion}.
          </DialogDescription>
        </DialogHeader>
        {ANDROID_RELEASE_NOTES[latest] ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What's new</p>
            {ANDROID_RELEASE_NOTES[latest]}
          </div>
        ) : null}
        <div className="space-y-2">
          <Button onClick={update} className="w-full gap-2">
            <Download className="size-4" /> Update on Google Play
          </Button>
          <Button variant="ghost" onClick={later} className="w-full">
            Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Website updates: when a new version of the site goes live, everyone (browser
 * and app, since the app shows this site) gets a "Reload" message.
 */
function SiteUpdateNotice() {
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as { build?: string }
        if (cancelled || !json.build || json.build === __BUILD_TIME__) return
        if (localStorage.getItem(SITE_UPDATE_KEY) === json.build) return
        toast('A new version of AbiaConnect is ready', {
          id: 'site-update',
          description: 'Reload to get the latest improvements.',
          duration: Infinity,
          action: { label: 'Reload', onClick: () => location.reload() },
          onDismiss: () => save(SITE_UPDATE_KEY, json.build!),
        })
      } catch {
        // Offline or blocked: try again later.
      }
    }
    const first = window.setTimeout(check, 15000)
    const every = window.setInterval(check, SITE_CHECK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(first)
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}

/** All app messages: get the app, update the app, reload the website. */
export function AppNotices() {
  if (import.meta.env.DEV) return null
  return (
    <>
      <GetAppBanner />
      <AppUpdateDialog />
      <SiteUpdateNotice />
    </>
  )
}
