import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { playNotificationChime } from '@/lib/notificationSound'
import { toast } from 'sonner'

/**
 * Registers the device for FCM/APNs push notifications when running inside the
 * Capacitor native app, then stores the device token in `device_push_tokens`
 * so the backend can deliver pushes to this device.
 */
export function usePushNotifications() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    if (!Capacitor.isNativePlatform()) return

    let removeListeners: (() => void) | null = null

    ;(async () => {
      try {
        // 1) Create the Android notification channel BEFORE asking for
        //    permission. Channels are required on Android 8+ for any
        //    notification to appear in the tray. No-op on iOS.
        if (Capacitor.getPlatform() === 'android') {
          try {
            await PushNotifications.createChannel({
              id: 'abia_default',
              name: 'AbiaConnect alerts',
              description: 'Messages, replies, mentions and system alerts',
              importance: 5, // IMPORTANCE_HIGH — heads-up + sound
              visibility: 1, // PUBLIC on lockscreen
              sound: 'default',
              vibration: true,
              lights: true,
            })
          } catch {
            // ignore — channel may already exist
          }
        }

        // 2) Android 13+ requires runtime POST_NOTIFICATIONS permission.
        //    requestPermissions() triggers the system dialog on Android 13+
        //    and is a no-op on older Android versions.
        let perm = await PushNotifications.checkPermissions()
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions()
        }
        if (perm.receive !== 'granted') return

        await PushNotifications.register()

        const platform =
          Capacitor.getPlatform() === 'ios' ? 'ios'
          : Capacitor.getPlatform() === 'android' ? 'android'
          : 'web'



        const regSub = await PushNotifications.addListener('registration', async (t) => {
          try {
            await supabase
              .from('device_push_tokens')
              .upsert(
                { user_id: user.id, token: t.value, platform, updated_at: new Date().toISOString() },
                { onConflict: 'token' },
              )
          } catch {
            // best-effort
          }
        })

        const errSub = await PushNotifications.addListener('registrationError', () => {
          // ignore — no token, no push
        })

        // Foreground push: app open. Show a toast + chime.
        const recvSub = await PushNotifications.addListener('pushNotificationReceived', (n) => {
          playNotificationChime()
          const title = n.title ?? (n.data as any)?.title ?? 'New notification'
          const body = n.body ?? (n.data as any)?.message ?? ''
          toast(title, { description: body })
        })

        // Tap on a push notification → optional deep link via data.url
        const actSub = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const url = (action.notification.data as any)?.url
            if (url && typeof window !== 'undefined') window.location.href = url
          },
        )

        removeListeners = () => {
          regSub.remove()
          errSub.remove()
          recvSub.remove()
          actSub.remove()
        }
      } catch {
        // ignore — push not available
      }
    })()

    return () => {
      removeListeners?.()
    }
  }, [user])
}
