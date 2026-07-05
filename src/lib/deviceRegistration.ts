// Helpers for registering the current device to receive push notifications.
// Native devices get a real FCM/APNs token via Capacitor. Web browsers get a
// stable local device id so the user can still opt in to app-update alerts
// (delivered in-app via the notifications bell).

import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'

const WEB_DEVICE_ID_KEY = 'abia.deviceId.v1'

export function getPlatformKind(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform()
  if (p === 'ios') return 'ios'
  if (p === 'android') return 'android'
  return 'web'
}

export function isNativeDevice(): boolean {
  return Capacitor.isNativePlatform()
}

export function guessDeviceLabel(): string {
  if (isNativeDevice()) {
    return Capacitor.getPlatform() === 'ios' ? 'iOS app' : 'Android app'
  }
  if (typeof navigator === 'undefined') return 'This device'
  const ua = navigator.userAgent
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Web'
  return `${browser} on ${os}`
}

function getOrCreateWebDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return `web-${crypto.randomUUID()}`
  }
  let id = localStorage.getItem(WEB_DEVICE_ID_KEY)
  if (!id) {
    id = `web-${crypto.randomUUID()}`
    localStorage.setItem(WEB_DEVICE_ID_KEY, id)
  }
  return id
}

export type RegistrationResult =
  | { status: 'registered'; platform: string; token: string }
  | { status: 'denied'; reason: string }
  | { status: 'unsupported'; reason: string }

/**
 * Register the current device for the signed-in user. Safe to call multiple
 * times — it upserts on the token, so re-enabling just refreshes metadata.
 */
export async function registerCurrentDevice(userId: string): Promise<RegistrationResult> {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const label = guessDeviceLabel()

  if (isNativeDevice()) {
    try {
      const mod: any = await import('@capacitor/push-notifications')
      const { PushNotifications } = mod
      let perm = await PushNotifications.checkPermissions()
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        perm = await PushNotifications.requestPermissions()
      }
      if (perm.receive !== 'granted') {
        return { status: 'denied', reason: 'Notification permission was not granted.' }
      }

      // Register + wait for the token via a one-shot listener.
      const token: string = await new Promise((resolve, reject) => {
        let done = false
        const t = setTimeout(() => {
          if (!done) reject(new Error('Timed out waiting for push token'))
        }, 15000)
        PushNotifications.addListener('registration', (evt: { value: string }) => {
          if (done) return
          done = true
          clearTimeout(t)
          resolve(evt.value)
        })
        PushNotifications.addListener('registrationError', (e: unknown) => {
          if (done) return
          done = true
          clearTimeout(t)
          reject(new Error(typeof e === 'string' ? e : 'Push registration failed'))
        })
        PushNotifications.register()
      })

      const platform = getPlatformKind()
      const { error } = await supabase.from('device_push_tokens').upsert(
        {
          user_id: userId,
          token,
          platform,
          device_label: label,
          user_agent: ua,
          notify_updates: true,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'token' },
      )
      if (error) throw error
      return { status: 'registered', platform, token }
    } catch (e) {
      return { status: 'denied', reason: e instanceof Error ? e.message : 'Could not register device' }
    }
  }

  // Web browser path: no FCM/APNs token available without a service worker +
  // VAPID key, so we still capture the opt-in with a stable device id. The
  // admin release broadcaster also seeds an in-app notification for every
  // user, which is what web users will actually see.
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { status: 'unsupported', reason: 'This browser does not support notifications.' }
  }
  let perm = Notification.permission
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission()
    } catch {
      /* older Safari without promise */
    }
  }
  if (perm !== 'granted') {
    return { status: 'denied', reason: 'Browser notification permission was not granted.' }
  }

  const token = getOrCreateWebDeviceId()
  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: 'web',
      device_label: label,
      user_agent: ua,
      notify_updates: true,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  )
  if (error) return { status: 'denied', reason: error.message }
  return { status: 'registered', platform: 'web', token }
}

export function getCurrentWebToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(WEB_DEVICE_ID_KEY)
}
