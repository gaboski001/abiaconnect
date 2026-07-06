import { useCallback, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

export type DownloadStatus =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'failed'

export interface DownloadState {
  status: DownloadStatus
  /** 0..1 fraction; null when total size is unknown */
  progress: number | null
  /** Bytes/sec, averaged */
  speed: number | null
  /** Total bytes when known */
  total: number | null
  loaded: number
  error: string | null
  /**
   * Filename of the APK we've downloaded to app storage (Android native only).
   * When set, the user can retry the install without re-downloading.
   */
  installFilename: string | null
  /**
   * True when the Android package installer refused to launch because the
   * user hasn't granted "Install unknown apps" yet. UI surfaces a
   * "Grant permission" + "Install now" pair when this is set.
   */
  permissionRequired: boolean
}

const initial: DownloadState = {
  status: 'idle',
  progress: null,
  speed: null,
  total: null,
  loaded: 0,
  error: null,
  installFilename: null,
  permissionRequired: false,
}

async function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = '@capacitor/' + 'browser'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m: any = await new Function('x', 'return import(x)')(mod)
      if (m?.Browser?.open) {
        await m.Browser.open({ url })
        return
      }
    } catch {
      /* fall through */
    }
    try {
      const w = window.open(url, '_system')
      if (w) return
    } catch {
      /* fall through */
    }
  }
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 15_000)
}

export interface DownloadInput {
  filePath: string
  version: string
  platform: 'android' | 'ios' | 'web'
  fileSize?: number | null
}

interface NativeApkInstaller {
  installFromUrl: (url: string, filename: string) => void
  installExisting?: (filename: string) => void
  hasDownloaded?: (filename: string) => boolean
  canInstall?: () => boolean
  openInstallSettings?: () => void
}

function getNativeInstaller(): NativeApkInstaller | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AbiaApkInstaller?: NativeApkInstaller }
  return w.AbiaApkInstaller && typeof w.AbiaApkInstaller.installFromUrl === 'function'
    ? w.AbiaApkInstaller
    : null
}

function androidApkFilename(version: string) {
  return `AbiaConnect-v${version}.apk`
}

export function useReleaseDownload() {
  const [state, setState] = useState<DownloadState>(initial)
  const abortRef = useRef<AbortController | null>(null)
  const nativeCleanupRef = useRef<(() => void) | null>(null)
  // Remember the last Android APK we prepared so the user can retry install
  // without re-downloading — even after the download hook is re-mounted.
  const lastNativeFilenameRef = useRef<string | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    nativeCleanupRef.current?.()
    nativeCleanupRef.current = null
    setState(initial)
  }, [])

  const attachNativeListeners = useCallback((filename: string) => {
    nativeCleanupRef.current?.()

    const started = performance.now()
    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail as { loaded: number; total: number; speed: number }
      const loaded = Number(detail.loaded) || 0
      const knownTotal = Number(detail.total) > 0 ? Number(detail.total) : null
      const elapsedSec = Math.max(0.001, (performance.now() - started) / 1000)
      const speed = Number(detail.speed) || loaded / elapsedSec
      setState((s) => ({
        ...s,
        status: 'downloading',
        total: knownTotal ?? s.total,
        loaded,
        progress: knownTotal ? Math.min(1, loaded / knownTotal) : s.progress,
        speed,
        error: null,
        installFilename: filename,
        permissionRequired: false,
      }))
    }
    const onInstalling = () => {
      setState((s) => ({
        ...s,
        status: 'installing',
        progress: 1,
        speed: null,
        error: null,
        installFilename: filename,
        permissionRequired: false,
      }))
      toast.success('Installing update — approve the prompt to finish.')
    }
    const onPermissionRequired = () => {
      setState((s) => ({
        ...s,
        status: 'installing',
        progress: 1,
        speed: null,
        error: null,
        installFilename: filename,
        permissionRequired: true,
      }))
      toast.info('Allow "Install unknown apps", then tap Install now.')
    }
    const onError = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string }
      const msg = detail?.message ?? 'Download failed'
      const permissionHint = /permiss|unknown app|install.*block|not allowed/i.test(msg)
      setState((s) => ({
        ...s,
        status: 'failed',
        error: msg,
        // Preserve the cached filename so the failed strip can offer
        // "Install now" without forcing a fresh download.
        installFilename: s.installFilename ?? filename,
        permissionRequired: permissionHint || s.permissionRequired,
      }))
      toast.error(msg)
    }

    window.addEventListener('abiaconnect-apk-progress', onProgress as EventListener)
    window.addEventListener('abiaconnect-apk-installing', onInstalling as EventListener)
    window.addEventListener(
      'abiaconnect-apk-permission-required',
      onPermissionRequired as EventListener,
    )
    window.addEventListener('abiaconnect-apk-error', onError as EventListener)

    nativeCleanupRef.current = () => {
      window.removeEventListener('abiaconnect-apk-progress', onProgress as EventListener)
      window.removeEventListener('abiaconnect-apk-installing', onInstalling as EventListener)
      window.removeEventListener(
        'abiaconnect-apk-permission-required',
        onPermissionRequired as EventListener,
      )
      window.removeEventListener('abiaconnect-apk-error', onError as EventListener)
    }
  }, [])

  const download = useCallback(
    async (input: DownloadInput) => {
      if (state.status === 'downloading' || state.status === 'preparing') return
      abortRef.current?.abort()
      nativeCleanupRef.current?.()
      nativeCleanupRef.current = null
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setState({ ...initial, status: 'preparing' })

      try {
        // Android native fast-path: if we already have this APK on disk from
        // a prior attempt, jump straight to install — no re-download.
        const installer = getNativeInstaller()
        if (
          Capacitor.isNativePlatform() &&
          input.platform === 'android' &&
          installer &&
          typeof installer.hasDownloaded === 'function'
        ) {
          const filename = androidApkFilename(input.version)
          try {
            if (installer.hasDownloaded(filename)) {
              lastNativeFilenameRef.current = filename
              attachNativeListeners(filename)
              setState({
                ...initial,
                status: 'installing',
                progress: 1,
                installFilename: filename,
              })
              installer.installExisting?.(filename)
              return
            }
          } catch {
            /* fall through to full download */
          }
        }

        const { data, error } = await supabase.storage
          .from('app-releases')
          .createSignedUrl(input.filePath, 60 * 10, { download: true })
        if (error || !data?.signedUrl) {
          setState((s) => ({ ...s, status: 'failed', error: 'Could not generate download link.' }))
          toast.error('Could not generate download link.')
          return
        }
        const signedUrl = data.signedUrl

        // iOS: cannot install an IPA via a WebView blob — hand straight to the
        // OS installer (TestFlight / signed IPA over HTTPS).
        if (Capacitor.isNativePlatform() && input.platform === 'ios') {
          await openExternal(signedUrl)
          setState({ ...initial, status: 'installing', progress: 1 })
          return
        }

        // Android native: prefer the in-app installer bridge which downloads
        // to app storage and launches the package installer via FileProvider —
        // no browser handoff, no persistent download notification.
        if (Capacitor.isNativePlatform() && input.platform === 'android' && installer) {
          const filename = androidApkFilename(input.version)
          lastNativeFilenameRef.current = filename
          const total = input.fileSize ?? null
          setState({
            ...initial,
            status: 'downloading',
            total,
            progress: total ? 0 : null,
            installFilename: filename,
          })
          attachNativeListeners(filename)

          try {
            installer.installFromUrl(signedUrl, filename)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not start installer'
            setState((s) => ({ ...s, status: 'failed', error: msg }))
            toast.error('Could not start installer.')
          }
          return
        }

        const res = await fetch(signedUrl, { signal: ctrl.signal })
        if (!res.ok || !res.body) {
          setState((s) => ({ ...s, status: 'failed', error: `Download failed (HTTP ${res.status}).` }))
          toast.error('Download failed. Please try again.')
          return
        }

        const totalHeader = Number(res.headers.get('content-length') || 0)
        const total = totalHeader > 0 ? totalHeader : input.fileSize ?? null

        setState({ ...initial, status: 'downloading', total, progress: total ? 0 : null })

        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let loaded = 0
        const started = performance.now()
        let lastPush = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            loaded += value.byteLength
            const now = performance.now()
            if (now - lastPush > 100) {
              lastPush = now
              const elapsedSec = Math.max(0.001, (now - started) / 1000)
              const speed = loaded / elapsedSec
              setState({
                status: 'downloading',
                total,
                loaded,
                progress: total ? Math.min(1, loaded / total) : null,
                speed,
                error: null,
                installFilename: null,
                permissionRequired: false,
              })
            }
          }
        }

        const blob = new Blob(chunks as BlobPart[], {
          type:
            input.platform === 'android'
              ? 'application/vnd.android.package-archive'
              : 'application/octet-stream',
        })

        const filename =
          input.platform === 'android'
            ? androidApkFilename(input.version)
            : `AbiaConnect-v${input.version}.ipa`

        setState({
          status: 'installing',
          total,
          loaded,
          progress: 1,
          speed: null,
          error: null,
          installFilename: null,
          permissionRequired: false,
        })

        if (Capacitor.isNativePlatform() && input.platform === 'android') {
          // Fallback path (bridge missing): hand the URL to the OS browser so
          // Android's Download Manager can trigger the installer.
          await openExternal(signedUrl)
        } else {
          triggerBlobDownload(blob, filename)
        }

        toast.success(
          input.platform === 'android'
            ? 'Download ready — tap Install when prompted.'
            : 'Download ready.',
        )
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') {
          setState(initial)
          return
        }
        const msg = e instanceof Error ? e.message : 'Download failed.'
        setState((s) => ({ ...s, status: 'failed', error: msg }))
        toast.error('Download failed. Please try again.')
      } finally {
        abortRef.current = null
      }
    },
    [state.status, attachNativeListeners],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    nativeCleanupRef.current?.()
    nativeCleanupRef.current = null
    setState(initial)
  }, [])

  /**
   * Re-launch the Android package installer for the APK we already
   * downloaded — used by the "Install now" button when the user dismissed
   * the system prompt or just granted "install unknown apps".
   */
  const installExisting = useCallback(() => {
    const installer = getNativeInstaller()
    const filename = state.installFilename ?? lastNativeFilenameRef.current
    if (!installer || !filename || typeof installer.installExisting !== 'function') {
      toast.error('No cached update to install. Please download again.')
      return
    }
    attachNativeListeners(filename)
    setState((s) => ({
      ...s,
      status: 'installing',
      progress: 1,
      error: null,
      installFilename: filename,
      permissionRequired: false,
    }))
    try {
      installer.installExisting(filename)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not open installer'
      setState((s) => ({ ...s, status: 'failed', error: msg }))
      toast.error(msg)
    }
  }, [state.installFilename, attachNativeListeners])

  const openInstallSettings = useCallback(() => {
    const installer = getNativeInstaller()
    if (installer?.openInstallSettings) {
      try {
        installer.openInstallSettings()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const hasCachedInstall = useCallback(() => {
    const installer = getNativeInstaller()
    const filename = state.installFilename ?? lastNativeFilenameRef.current
    if (!installer || !filename) return false
    if (typeof installer.hasDownloaded === 'function') {
      try {
        return !!installer.hasDownloaded(filename)
      } catch {
        return !!state.installFilename
      }
    }
    return !!state.installFilename
  }, [state.installFilename])

  return { state, download, cancel, reset, installExisting, openInstallSettings, hasCachedInstall }
}

/**
 * Public shape returned by {@link useReleaseDownload}. Components that render
 * update UI should depend on this type instead of re-declaring the props they
 * consume, so future additions to the hook flow through without breaking
 * TypeScript at every render site.
 */
export type ReleaseDownloadController = ReturnType<typeof useReleaseDownload>
