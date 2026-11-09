import { Capacitor } from '@capacitor/core'

/**
 * Opens a link outside the app: in the app, the phone's browser or file viewer
 * (used for app updates and contest PDFs); on the website, a new tab.
 */
export async function openExternal(url: string) {
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
