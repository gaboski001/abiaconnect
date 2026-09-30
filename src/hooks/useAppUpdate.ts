import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type AppUpdateRelease = {
  id: string
  platform: 'android' | 'ios'
  version: string
  file_path: string
  file_size: number | null
  changelog: string | null
  created_at: string
}

/**
 * Compare two version strings numerically, segment by segment.
 *
 * Handles SemVer-style pre-release and build-metadata suffixes so we never
 * treat `1.2.3-beta` or `1.2.3+build.7` as a "newer" version than `1.2.3`.
 * Rules:
 *   - Strip build metadata (everything after `+`) — SemVer says it's ignored.
 *   - Split off the pre-release tag (everything after `-`).
 *   - Compare numeric MAJOR.MINOR.PATCH first.
 *   - If those are equal, a version WITHOUT a pre-release tag is greater
 *     than one WITH a pre-release tag (1.2.3 > 1.2.3-beta).
 *   - Two pre-release tags compare lexicographically (1.2.3-beta.2 > 1.2.3-beta.1).
 * Returns negative if a<b, positive if a>b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const noBuild = v.split('+')[0] ?? ''
    const [core, ...preParts] = noBuild.split('-')
    const pre = preParts.join('-') // preserve dashes inside pre-release tag
    const nums = (core || '').split('.').map((n) => parseInt(n, 10) || 0)
    return { nums, pre }
  }
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.nums.length, pb.nums.length)
  for (let i = 0; i < len; i++) {
    const d = (pa.nums[i] || 0) - (pb.nums[i] || 0)
    if (d !== 0) return d
  }
  // Numeric core is equal — apply SemVer pre-release rule.
  if (!pa.pre && pb.pre) return 1 // 1.2.3 > 1.2.3-beta
  if (pa.pre && !pb.pre) return -1 // 1.2.3-beta < 1.2.3
  if (pa.pre && pb.pre) return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
  return 0
}


// Dynamically load @capacitor/app without a static import so the web build
// doesn't require the native-only plugin to be installed.
async function loadCapacitorApp(): Promise<any | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = '@capacitor/' + 'app'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any = await (new Function('x', 'return import(x)'))(mod)
    return m
  } catch {
    return null
  }
}

async function getCurrentNativeVersion(): Promise<string | null> {
  const m = await loadCapacitorApp()
  if (!m) return null
  try {
    const info = await m.App.getInfo()
    return info.version as string
  } catch {
    return null
  }
}

/**
 * Returns the latest active release for the current native platform
 * only when it's strictly newer than the installed native version.
 * Returns null on web, when there's no release, or when already up to date.
 */
export function useAppUpdate() {
  const [isNative, setIsNative] = useState(false)
  const [platform, setPlatform] = useState<'android' | 'ios' | 'web'>('web')
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const native = Capacitor.isNativePlatform()
    setIsNative(native)
    setPlatform(Capacitor.getPlatform() as 'android' | 'ios' | 'web')
    if (!native) {
      setReady(true)
      return
    }
    let cancelled = false
    const refreshNativeVersion = () => {
      getCurrentNativeVersion().then((v) => {
        if (cancelled) return
        setCurrentVersion(v)
        setReady(true)
      })
    }
    refreshNativeVersion()
    // After a self-update install completes, the app relaunches and this
    // hook remounts, but on some Android OEMs the WebView is only resumed
    // (not fully torn down). Re-read the installed version whenever the
    // app returns to foreground so the update banner disappears as soon
    // as the newer build is actually running.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshNativeVersion()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Also listen to Capacitor App lifecycle events. On Android, returning
    // from the system package-installer often does NOT fire a
    // `visibilitychange` (the WebView was never fully hidden), but
    // `appStateChange` + `resume` always do. Re-read the installed version
    // on both so the "Update available" banner clears the instant the
    // freshly-installed APK is running.
    const appHandles: Array<{ remove: () => void } | Promise<{ remove: () => void }>> = []
    loadCapacitorApp().then((m) => {
      if (cancelled || !m?.App) return
      try {
        appHandles.push(
          m.App.addListener('appStateChange', (state: { isActive: boolean }) => {
            if (state?.isActive) refreshNativeVersion()
          }),
        )
        appHandles.push(m.App.addListener('resume', () => refreshNativeVersion()))
      } catch {
        /* listener setup failed — visibilitychange is still active */
      }
    })

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      appHandles.forEach((h) => {
        Promise.resolve(h)
          .then((handle) => handle?.remove?.())
          .catch(() => {})
      })
    }
  }, [])

  const q = useQuery({
    queryKey: ['app-update', platform],
    // Android updates must come from Google Play (Play policy forbids
    // self-updating via downloaded APKs), so only iOS checks here.
    enabled: ready && isNative && platform === 'ios',
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    queryFn: async (): Promise<AppUpdateRelease | null> => {
      const { data, error } = await supabase
        .from('app_releases')
        .select('id, platform, version, file_path, file_size, changelog, created_at')
        .eq('is_active', true)
        .eq('platform', platform)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return null
      return data as AppUpdateRelease
    },
  })

  const release = q.data ?? null
  // Only surface an update when we can *prove* the installed native build is
  // older than the latest active release. If we can't read the installed
  // version (plugin missing, App.getInfo threw, etc.), stay silent — showing
  // "Update available" against an unknown version leaves the banner stuck
  // forever after the user has already installed the newest APK.
  const hasUpdate =
    isNative &&
    !!release &&
    !!currentVersion &&
    compareVersions(release.version, currentVersion) > 0


  return {
    isNative,
    platform,
    currentVersion,
    release: hasUpdate ? release : null,
    hasUpdate,
    isLoading: q.isLoading || !ready,
  }
}
