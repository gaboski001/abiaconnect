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

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

async function getCurrentNativeVersion(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const mod = '@capacitor/' + 'app'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m: any = await (new Function('x', 'return import(x)'))(mod)
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
    getCurrentNativeVersion().then((v) => {
      setCurrentVersion(v)
      setReady(true)
    })
  }, [])

  const q = useQuery({
    queryKey: ['app-update', platform],
    enabled: ready && isNative && (platform === 'android' || platform === 'ios'),
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
  const hasUpdate =
    isNative &&
    !!release &&
    (!currentVersion || compareVersions(release.version, currentVersion) > 0)

  return {
    isNative,
    platform,
    currentVersion,
    release: hasUpdate ? release : null,
    hasUpdate,
    isLoading: q.isLoading || !ready,
  }
}
