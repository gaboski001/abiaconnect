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
}

const initial: DownloadState = {
  status: 'idle',
  progress: null,
  speed: null,
  total: null,
  loaded: 0,
  error: null,
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

export function useReleaseDownload() {
  const [state, setState] = useState<DownloadState>(initial)
  const abortRef = useRef<AbortController | null>(null)
  const nativeCleanupRef = useRef<(() => void) | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    nativeCleanupRef.current?.()
    nativeCleanupRef.current = null
    setState(initial)
  }, [])

  const download = useCallback(async (input: DownloadInput) => {
    if (state.status === 'downloading' || state.status === 'preparing') return
    abortRef.current?.abort()
    nativeCleanupRef.current?.()
    nativeCleanupRef.current = null
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setState({ ...initial, status: 'preparing' })

    try {
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
      const installer = getNativeInstaller()
      if (Capacitor.isNativePlatform() && input.platform === 'android' && installer) {
        const filename = `AbiaConnect-v${input.version}.apk`
        const total = input.fileSize ?? null
        setState({ ...initial, status: 'downloading', total, progress: total ? 0 : null })

        const started = performance.now()
        const onProgress = (e: Event) => {
          const detail = (e as CustomEvent).detail as { loaded: number; total: number; speed: number }
          const loaded = Number(detail.loaded) || 0
          const knownTotal = Number(detail.total) > 0 ? Number(detail.total) : total
          const elapsedSec = Math.max(0.001, (performance.now() - started) / 1000)
          const speed = Number(detail.speed) || loaded / elapsedSec
          setState({
            status: 'downloading',
            total: knownTotal,
            loaded,
            progress: knownTotal ? Math.min(1, loaded / knownTotal) : null,
            speed,
            error: null,
          })
        }
        const onInstalling = () => {
          setState((s) => ({ ...s, status: 'installing', progress: 1, speed: null, error: null }))
          toast.success('Installing update — approve the prompt to finish.')
        }
        const onError = (e: Event) => {
          const detail = (e as CustomEvent).detail as { message?: string }
          const msg = detail?.message ?? 'Download failed'
          setState((s) => ({ ...s, status: 'failed', error: msg }))
          toast.error('Download failed. Please try again.')
        }
        window.addEventListener('abiaconnect-apk-progress', onProgress as EventListener)
        window.addEventListener('abiaconnect-apk-installing', onInstalling as EventListener)
        window.addEventListener('abiaconnect-apk-error', onError as EventListener)
        nativeCleanupRef.current = () => {
          window.removeEventListener('abiaconnect-apk-progress', onProgress as EventListener)
          window.removeEventListener('abiaconnect-apk-installing', onInstalling as EventListener)
          window.removeEventListener('abiaconnect-apk-error', onError as EventListener)
        }

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
          ? `AbiaConnect-v${input.version}.apk`
          : `AbiaConnect-v${input.version}.ipa`

      setState({ status: 'installing', total, loaded, progress: 1, speed: null, error: null })

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
  }, [state.status])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    nativeCleanupRef.current?.()
    nativeCleanupRef.current = null
    setState(initial)
  }, [])

  return { state, download, cancel, reset }
}

