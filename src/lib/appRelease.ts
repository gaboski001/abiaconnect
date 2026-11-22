/**
 * The AbiaConnect Android app on Google Play: where to get it, which version
 * is live there, and when to tell someone about it. Pure, so it can be tested.
 */
import { compareVersions } from '@/lib/compareVersions'
import { safeStoreUrl } from '@/components/pwa/StoreBadges'

export const ANDROID_PACKAGE = 'com.abiaconnect.app'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

/**
 * The newest version members can install from Google Play. Raise it ONLY once
 * Google has approved the release and it shows on Play, or members are sent to
 * a store page that has no update for them yet. App users on an older version
 * see "Update available" (the app loads this website, so this reaches them
 * without a new app).
 */
export const LATEST_ANDROID_RELEASE = { version: '1.1.2' }

/** What's new, per version, in plain words (shown in the update message). */
export const ANDROID_RELEASE_NOTES: Record<string, string> = {
  '1.1.2': 'Fixes and improvements to keep AbiaConnect fast and reliable.',
  '1.1.3':
    'Keep talking while you use the app: on a call, tap the arrow at the top to shrink it into a small window, then chat and reply to messages. Video calls keep showing in a small window when you leave the app.',
}

/** The Play link saved by admins, or the app's own Play page. */
export function playStoreLink(saved?: string | null) {
  return safeStoreUrl(saved, 'play') ?? PLAY_STORE_URL
}

/** An Android phone or tablet using the website in a browser (not the app). */
export function isAndroidBrowser(userAgent: string, isNativeApp: boolean) {
  return !isNativeApp && /Android/i.test(userAgent)
}

/** How long "Not now" keeps the Get-the-app message away. */
export const GET_APP_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Offer the app to Android browser visitors who don't have it yet. Members who
 * have ever opened the app while signed in (their account remembers it) are
 * never asked.
 */
export function shouldOfferApp(input: {
  androidBrowser: boolean
  hasAppOnAccount: boolean
  snoozedAt: number | null
  now: number
}) {
  if (!input.androidBrowser || input.hasAppOnAccount) return false
  if (input.snoozedAt && input.now - input.snoozedAt < GET_APP_SNOOZE_MS) return false
  return true
}

/** True when the installed app is older than the version live on Google Play. */
export function androidUpdateAvailable(installed: string | null, latest = LATEST_ANDROID_RELEASE.version) {
  if (!installed) return false
  return compareVersions(latest, installed) > 0
}
