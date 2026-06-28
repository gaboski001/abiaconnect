import { useCallback, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { playNotificationChime } from '@/lib/notificationSound'
import { toast } from 'sonner'

const PUSH_CHANNEL_ID = 'abia_default'
const PUSH_CHANNEL_NAME = 'AbiaConnect alerts'
const PUSH_CHANNEL_DESCRIPTION = 'Messages, replies, mentions and system alerts'
const DEFAULT_PUSH_ROUTE = '/notifications'
const PENDING_PUSH_ROUTE_KEY = 'abia_pending_push_route'

function normalizePushRoute(raw?: string | null): string {
  if (!raw) return DEFAULT_PUSH_ROUTE

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw)
      const next = `${url.pathname}${url.search}${url.hash}`
      return next || DEFAULT_PUSH_ROUTE
    }
  } catch {
    // fall through to relative-path handling
  }

  return raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`
}

function resolvePushRoute(data?: Record<string, unknown> | null): string {
  const url = typeof data?.url === 'string' ? data.url : null
  if (url) return normalizePushRoute(url)

  const conversationId = typeof data?.conversationId === 'string' ? data.conversationId : null
  if (conversationId) return `/messages/${conversationId}`

  const type = typeof data?.type === 'string' ? data.type : null
  if (type === 'call') return conversationId ? `/messages/${conversationId}` : '/messages'
  if (type === 'message') return '/messages'

  return DEFAULT_PUSH_ROUTE
}

async function ensureAndroidPushChannel() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return

  try {
    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: PUSH_CHANNEL_NAME,
      description: PUSH_CHANNEL_DESCRIPTION,
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
    })
  } catch {
    // Channel may already exist.
  }
}

function isAppVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

/**
 * Native push bootstrap.
 *
 * Responsibilities are deliberately split:
 * 1) Route taps from background / terminated notifications as early as possible.
 * 2) Register the signed-in device token with Supabase for delivery.
 */
export function usePushNotifications() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  const queueOrNavigate = useCallback((route: string) => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(PENDING_PUSH_ROUTE_KEY, route)
    if (loading) return
    if (userId) {
      sessionStorage.removeItem(PENDING_PUSH_ROUTE_KEY)
      navigate(route, { replace: true })
      return
    }
    navigate('/login', { replace: true })
  }, [loading, navigate, userId])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false
    let removeListeners: (() => void) | null = null

    ;(async () => {
      await ensureAndroidPushChannel()
      if (cancelled) return

      const receivedSub = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        if (!isAppVisible()) return

        playNotificationChime()
        const title = notification.title ?? (notification.data as { title?: string } | undefined)?.title ?? 'New notification'
        const body = notification.body ?? (notification.data as { message?: string; body?: string } | undefined)?.message ?? (notification.data as { body?: string } | undefined)?.body ?? ''
        const type = (notification.data as { type?: string } | undefined)?.type
        toast(type === 'call' ? 'Incoming call' : title, { description: body || (type === 'call' ? 'Open AbiaConnect to answer.' : '') })
      })

      const actionSub = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const route = resolvePushRoute((action.notification.data ?? {}) as Record<string, unknown>)
        queueOrNavigate(route)
      })

      const nativeNotificationHandler = (event: Event) => {
        const detail = (event as CustomEvent<{ url?: string }>).detail
        const route = normalizePushRoute(detail?.url)
        queueOrNavigate(route)
      }
      if (cancelled) {
        receivedSub.remove()
        actionSub.remove()
        return
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('abiaconnect-native-notification', nativeNotificationHandler as EventListener)
      }

      removeListeners = () => {
        receivedSub.remove()
        actionSub.remove()
        if (typeof window !== 'undefined') {
          window.removeEventListener('abiaconnect-native-notification', nativeNotificationHandler as EventListener)
        }
      }
    })().catch(() => {
      // Ignore on unsupported environments.
    })

    return () => {
      cancelled = true
      removeListeners?.()
    }
  }, [queueOrNavigate])

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return

    let cancelled = false
    let removeListeners: (() => void) | null = null

    ;(async () => {
      try {
        await ensureAndroidPushChannel()
        if (cancelled) return

        let perm = await PushNotifications.checkPermissions()
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          perm = await PushNotifications.requestPermissions()
        }
        if (cancelled || perm.receive !== 'granted') return

        const platform =
          Capacitor.getPlatform() === 'ios' ? 'ios'
          : Capacitor.getPlatform() === 'android' ? 'android'
          : 'web'

        const regSub = await PushNotifications.addListener('registration', async (token) => {
          try {
            await supabase
              .from('device_push_tokens')
              .upsert(
                {
                  user_id: userId,
                  token: token.value,
                  platform,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'token' },
              )
          } catch {
            // Best effort — a failed upsert should never crash the app.
          }
        })

        const errSub = await PushNotifications.addListener('registrationError', () => {
          // Best effort — surfaced through the admin checklist when needed.
        })
        if (cancelled) {
          regSub.remove()
          errSub.remove()
          return
        }

        removeListeners = () => {
          regSub.remove()
          errSub.remove()
        }

        await PushNotifications.register()
      } catch {
        // Ignore — push may be unavailable on this environment.
      }
    })()

    return () => {
      cancelled = true
      removeListeners?.()
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined' || loading || !userId) return
    const pendingRoute = sessionStorage.getItem(PENDING_PUSH_ROUTE_KEY)
    if (!pendingRoute) return
    sessionStorage.removeItem(PENDING_PUSH_ROUTE_KEY)
    navigate(pendingRoute, { replace: true })
  }, [loading, navigate, userId])
}
