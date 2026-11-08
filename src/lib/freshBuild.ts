import { toast } from '@/lib/toast'

/**
 * The app keeps the site it loaded in memory, so when it is only brought back
 * to the front it never sees changes we publish. Each time it comes back we
 * ask the server which version is current, and if it is newer we load it.
 */

/** Screens where reloading by itself would interrupt the member (a live room, a call, writing something). */
const BUSY = [/^\/live\/./, /^\/call/, /^\/create-thread/, /^\/messages\/./, /\/edit/, /\/new$/]

/** The main script the page is running now, e.g. /assets/index-AbC123.js. */
export function runningBuild(doc: Document = document): string | null {
  const s = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
  return s ? new URL(s.src, location.origin).pathname : null
}

/** The main script named in a fresh copy of the home page. */
export function buildIn(html: string): string | null {
  const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
  return m ? m[0] : null
}

export async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return buildIn(await res.text())
  } catch {
    return null // offline: try again next time
  }
}

export function isBusy(path: string) {
  return BUSY.some((r) => r.test(path))
}

let checking = false

export async function checkForNewBuild(reload: () => void = () => location.reload()) {
  if (checking) return
  checking = true
  try {
    const now = runningBuild()
    const latest = await latestBuild()
    if (!now || !latest || now === latest) return
    if (!isBusy(location.pathname)) {
      reload()
      return
    }
    toast('A new version of AbiaConnect is ready.', {
      id: 'new-build',
      duration: Infinity,
      action: { label: 'Refresh', onClick: reload },
    })
  } finally {
    checking = false
  }
}

/** Check whenever the app comes back to the front. */
export function watchForNewBuilds() {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void checkForNewBuild()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}
