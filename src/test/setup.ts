import '@testing-library/jest-dom'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Node 25+ ships its own global `localStorage`/`sessionStorage` (Web Storage
// API) which shadows jsdom's and is unusable without --localstorage-file.
// Install a simple in-memory Storage whenever the global one is broken, so
// tests behave the same on every Node version (CI uses Node 20).
function createMemoryStorage(): Storage {
  let store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => {
      store = new Map()
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let usable = false
  try {
    const s = (globalThis as any)[name] as Storage | undefined
    usable = !!s && typeof s.clear === 'function' && typeof s.getItem === 'function'
  } catch {
    usable = false
  }
  if (!usable) {
    const storage = createMemoryStorage()
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: storage })
    Object.defineProperty(window, name, { configurable: true, writable: true, value: storage })
  }
}
