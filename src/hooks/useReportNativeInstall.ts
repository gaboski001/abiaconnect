import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

async function getNativeVersion(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = '@capacitor/' + 'app'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any = await new Function('x', 'return import(x)')(mod)
    const info = await m.App.getInfo()
    return (info?.version as string) ?? null
  } catch {
    return null
  }
}

/**
 * When the app is running inside the native shell (Capacitor) and a user is
 * signed in, stamp `native_app_installed_at` on the profile. The web
 * download card reads that flag and hides itself once the user has the
 * mobile app installed.
 *
 * Runs at most once per session per user (guarded by sessionStorage).
 */
export function useReportNativeInstall() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    if (!Capacitor.isNativePlatform()) return

    const key = `native-install-reported:${user.id}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return

    let cancelled = false
    ;(async () => {
      const platform = Capacitor.getPlatform() // 'ios' | 'android'
      const version = await getNativeVersion()
      if (cancelled) return
      const { error } = await supabase
        .from('profiles')
        .update({
          native_app_installed_at: new Date().toISOString(),
          native_app_platform: platform,
          native_app_version: version,
        })
        .eq('id', user.id)
      if (!error && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, '1')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])
}
