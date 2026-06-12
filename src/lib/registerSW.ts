// Guarded service worker registration. Never runs in dev or Lovable preview.
export function registerSW() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return
  try {
    if (window.self !== window.top) return
  } catch {
    return
  }
  const host = window.location.hostname
  const blocked =
    host.startsWith('id-preview--') ||
    host.startsWith('preview--') ||
    host === 'lovableproject.com' || host.endsWith('.lovableproject.com') ||
    host === 'lovableproject-dev.com' || host.endsWith('.lovableproject-dev.com') ||
    host === 'beta.lovable.dev' || host.endsWith('.beta.lovable.dev')
  if (new URL(window.location.href).searchParams.get('sw') === 'off' || blocked) {
    navigator.serviceWorker.getRegistrations().then((rs) =>
      rs.forEach((r) => {
        if (r.active?.scriptURL.endsWith('/sw.js')) r.unregister()
      }),
    ).catch(() => {})
    return
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
