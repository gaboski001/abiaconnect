import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

/**
 * Cleans up push notification tokens and listeners on sign-out.
 */
export async function cleanupPushNotifications() {
  if (!Capacitor.isNativePlatform()) return

  try {
    // 1. Get the current token if possible to remove it from DB
    // Capacitor PushNotifications doesn't have a direct "getToken" but we can
    // unregister which often invalidates it.
    await PushNotifications.removeAllListeners()
    await PushNotifications.unregister()

    // 2. Clear local storage flag if we had one (optional)
    localStorage.removeItem('abia:last-push-token')
  } catch (e) {
    console.error('[PushCleanup] Failed:', e)
  }
}
