import { Component, type ErrorInfo, type ReactNode } from 'react'

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
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error', error, info.componentStack)
    if (isOutdatedPageError(error)) reloadOnceForUpdate()
  }

  render() {
    if (!this.state.failed) return this.props.children
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
