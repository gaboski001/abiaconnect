/**
 * Always ask the database itself, never the browser's saved copy.
 *
 * Browsers may keep some error replies (status 300, which the database sends for
 * an ambiguous read) and reuse them forever, so one short database hiccup could
 * leave a member's forum broken long after it was fixed. Database replies carry
 * live data, so saving them never helps.
 */
export function isDatabaseRead(url: string, method: string | undefined): boolean {
  return (method ?? 'GET').toUpperCase() === 'GET' && url.includes('/rest/v1/')
}

export function keepDatabaseReadsFresh() {
  const original = window.fetch
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? (input instanceof Request ? input.method : undefined)
    return original.call(window, input, isDatabaseRead(url, method) ? { ...init, cache: 'no-store' } : init)
  }
}
