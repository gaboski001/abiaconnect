import { Component, type ErrorInfo, type ReactNode } from 'react'
import { WifiOff } from 'lucide-react'

const RELOADED_KEY = 'abiaconnect-reloaded-for-update'

/** A page file that no longer exists, because the site was updated while the app was open. */
export function isOutdatedPageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk/i.test(message)
}

/** Reloads to pick up the new site files, once, so a lasting fault cannot reload forever. */
export function reloadOnceForUpdate(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false
    sessionStorage.setItem(RELOADED_KEY, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/**
 * Without this, one page error empties the whole screen and nothing responds
 * until the app is closed. Shows a way out instead.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; offline: boolean }> {
  state = { failed: false, offline: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error', error, info.componentStack)
    // Offline, the page file simply could not download. Reloading now would only
    // show the phone's own error page, so wait for the network and reload then.
    if (navigator.onLine === false) {
      this.setState({ offline: true })
      window.addEventListener('online', this.retry, { once: true })
      return
    }
    if (isOutdatedPageError(error)) reloadOnceForUpdate()
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.retry)
  }

  retry = () => {
    if (navigator.onLine === false) return
    window.location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (this.state.offline) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
          <span className="flex size-16 items-center justify-center rounded-full bg-muted">
            <WifiOff className="size-7 text-muted-foreground" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold">No internet connection</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Check your Wi-Fi or mobile data, then try again. This page will open by itself when you are back online.
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </div>
      )
    }
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">This page could not open. Please try again.</p>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to home
        </button>
      </div>
    )
  }
}

export default AppErrorBoundary
