import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'

// ---- Mocks --------------------------------------------------------------

let installedVersion = '1.0.0'
let mockPlatform: 'android' | 'ios' = 'ios'
const resumeListeners: Array<(state: { isActive: boolean }) => void> = []
const appStateListeners: Array<(state: { isActive: boolean }) => void> = []

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => mockPlatform,
  },
}))

// The hook loads @capacitor/app via `new Function('return import(x)')` so it
// bypasses the module registry. Patch globalThis.Function to return our stub
// module for that specific dynamic import.
const OriginalFunction = globalThis.Function
beforeEach(() => {
  installedVersion = '1.0.0'
  mockPlatform = 'ios'
  resumeListeners.length = 0
  appStateListeners.length = 0

  const appStub = {
    App: {
      getInfo: async () => ({ version: installedVersion }),
      addListener: (event: string, cb: (state: { isActive: boolean }) => void) => {
        if (event === 'resume') resumeListeners.push(cb)
        if (event === 'appStateChange') appStateListeners.push(cb)
        return { remove: () => {} }
      },
    },
  }
  ;(globalThis as any).Function = function (...args: string[]) {
    const src = args[args.length - 1] ?? ''
    if (src.includes('import(x)')) {
      return (_x: string) => Promise.resolve(appStub)
    }
    return OriginalFunction(...args)
  } as unknown as FunctionConstructor
})
afterEach(() => {
  ;(globalThis as any).Function = OriginalFunction
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'r1',
                    platform: 'ios',
                    version: '4.0.1',
                    file_path: 'x.ipa',
                    file_size: 1000,
                    changelog: null,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}))

// ---- Import after mocks --------------------------------------------------
import { useAppUpdate } from './useAppUpdate'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useAppUpdate', () => {
  it('reports hasUpdate when installed version is older than latest release', async () => {
    const { result } = renderHook(() => useAppUpdate(), { wrapper })
    await waitFor(() => expect(result.current.hasUpdate).toBe(true))
    expect(result.current.release?.version).toBe('4.0.1')
    expect(result.current.currentVersion).toBe('1.0.0')
  })

  it('clears hasUpdate after Capacitor App "resume" fires with the new version', async () => {
    const { result } = renderHook(() => useAppUpdate(), { wrapper })
    await waitFor(() => expect(result.current.hasUpdate).toBe(true))
    await waitFor(() => expect(resumeListeners.length).toBeGreaterThan(0))

    // Simulate the user returning to the app now running the new version.
    installedVersion = '4.0.1'
    await act(async () => {
      resumeListeners.forEach((cb) => cb({ isActive: true }))
    })

    await waitFor(() => expect(result.current.currentVersion).toBe('4.0.1'))
    await waitFor(() => expect(result.current.hasUpdate).toBe(false))
    expect(result.current.release).toBeNull()
  })

  it('also clears hasUpdate on "appStateChange" active=true', async () => {
    const { result } = renderHook(() => useAppUpdate(), { wrapper })
    await waitFor(() => expect(result.current.hasUpdate).toBe(true))
    await waitFor(() => expect(appStateListeners.length).toBeGreaterThan(0))

    installedVersion = '4.0.1'
    await act(async () => {
      appStateListeners.forEach((cb) => cb({ isActive: true }))
    })
    await waitFor(() => expect(result.current.hasUpdate).toBe(false))
  })

  it('never reports an update on Android (updates come from Google Play)', async () => {
    mockPlatform = 'android'
    const { result } = renderHook(() => useAppUpdate(), { wrapper })
    await waitFor(() => expect(result.current.currentVersion).toBe('1.0.0'))
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.hasUpdate).toBe(false)
    expect(result.current.release).toBeNull()
  })

  it('does NOT show update when installed version cannot be read (plugin unavailable)', async () => {
    // Break the dynamic import so getCurrentNativeVersion() returns null,
    // matching the "You're on v?" state from the reported bug.
    ;(globalThis as any).Function = function (...args: string[]) {
      const src = args[args.length - 1] ?? ''
      if (src.includes('import(x)')) {
        return (_x: string) => Promise.reject(new Error('plugin missing'))
      }
      return OriginalFunction(...args)
    } as unknown as FunctionConstructor

    const { result } = renderHook(() => useAppUpdate(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Wait a tick for the query to settle.
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.currentVersion).toBeNull()
    expect(result.current.hasUpdate).toBe(false)
    expect(result.current.release).toBeNull()
  })
})

