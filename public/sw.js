// AbiaConnect kill-switch service worker.
// Purpose: force already-installed PWAs to drop stale caches, unregister the
// old app-shell worker, and reload to the latest deployed version on next open.
// Keep this file at /sw.js for one release cycle so returning browsers can
// pick it up via the standard SW update check, then it self-destructs.

function isAppShellCache(name) {
  // Only delete caches this app owned. Leave third-party (e.g. Firebase
  // Messaging, OneSignal) caches untouched — Cache Storage is origin-scoped.
  return /^abiaconnect-shell-/.test(name);
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter(isAppShellCache).map((n) => caches.delete(n))
        );
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: 'window' });
        await Promise.allSettled(
          windowClients.map((client) => client.navigate(client.url))
        );
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);

// No fetch handler — let the network serve fresh assets directly.
