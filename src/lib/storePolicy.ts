import { Capacitor } from '@capacitor/core'

/**
 * True inside the Android app. Google Play doesn't allow in-app donations or
 * sales of digital items outside Play Billing, so those are only offered on
 * the website (see also canPurchaseHere in lib/monetization/api.ts).
 */
export function isAndroidApp(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  } catch {
    return false
  }
}

/** Donations are offered on the website and iOS web, not inside the Android app. */
export const canDonateHere = () => !isAndroidApp()
