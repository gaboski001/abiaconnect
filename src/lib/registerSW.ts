// Guarded service worker registration with versioned update flow.
// - Registers /sw.js only in production, non-preview, non-iframe contexts.
// - Polls for updates hourly and on tab focus.
// - When a new worker is waiting, tells it to activate and reloads once
//   the new worker takes control. Only fires when the SW byte-changed,
//   so users aren't reload-looped on every page view.
export function registerSW() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }
  const host = window.location.hostname;
  const blocked =
    host.startsWith('id-preview--') ||
    host.startsWith('preview--') ||
    host === 'lovableproject.com' || host.endsWith('.lovableproject.com') ||
    host === 'lovableproject-dev.com' || host.endsWith('.lovableproject-dev.com') ||
    host === 'beta.lovable.dev' || host.endsWith('.beta.lovable.dev');
  if (new URL(window.location.href).searchParams.get('sw') === 'off' || blocked) {
    navigator.serviceWorker.getRegistrations().then((rs) =>
      rs.forEach((r) => {
        if (r.active?.scriptURL.endsWith('/sw.js')) r.unregister();
      }),
    ).catch(() => {});
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      let reloading = false;
      const reloadOnce = () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      };

      const promote = (worker: ServiceWorker | null) => {
        if (!worker) return;
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          // A previous SW is controlling the page → this one is a true update.
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      if (reg.waiting && navigator.serviceWorker.controller) {
        promote(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        installing?.addEventListener('statechange', () => promote(installing));
      });

      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

      // Periodic + focus-triggered update checks.
      const check = () => reg.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      window.addEventListener('focus', check);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    }).catch(() => {});
  });
}
