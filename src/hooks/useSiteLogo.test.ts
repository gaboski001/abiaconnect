import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const settingsState = vi.hoisted(() => ({
  settings: { site_logo: 'logos/new.webp' } as Record<string, string>,
  isLoading: false,
}))
const createSignedUrl = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useSiteSettings', () => ({ useSiteSettings: () => settingsState }))
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl }) } },
}))

import { useSiteLogo } from './useSiteLogo'

// Make preloaded images "load" immediately in jsdom.
Object.defineProperty(globalThis.Image.prototype, 'src', {
  set(this: HTMLImageElement) {
    setTimeout(() => this.onload?.(new Event('load')))
  },
})

describe('useSiteLogo', () => {
  beforeEach(() => {
    localStorage.clear()
    createSignedUrl.mockReset()
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/sign/logos/new.webp?t=1' } })
    settingsState.settings = { site_logo: 'logos/new.webp' }
    settingsState.isLoading = false
  })

  it('shows the cached logo on the first render, before settings load', () => {
    localStorage.setItem(
      'abia:site-logo',
      JSON.stringify({ path: 'logos/new.webp', url: 'https://x/cached.webp', expiresAt: Date.now() + 3_600_000 }),
    )
    settingsState.isLoading = true
    const { result } = renderHook(() => useSiteLogo())
    expect(result.current).toEqual({ url: 'https://x/cached.webp', status: 'ready' })
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('is "loading" (not a placeholder) with no cache, then shows the signed logo', async () => {
    settingsState.isLoading = true
    const { result, rerender } = renderHook(() => useSiteLogo())
    expect(result.current.status).toBe('loading')
    settingsState.isLoading = false
    rerender()
    await waitFor(() => expect(result.current.url).toBe('https://x/sign/logos/new.webp?t=1'))
    expect(result.current.status).toBe('ready')
    expect(JSON.parse(localStorage.getItem('abia:site-logo')!).path).toBe('logos/new.webp')
  })

  it('replaces a cached logo when an admin changed it', async () => {
    localStorage.setItem(
      'abia:site-logo',
      JSON.stringify({ path: 'logos/old.webp', url: 'https://x/old.webp', expiresAt: Date.now() + 3_600_000 }),
    )
    const { result } = renderHook(() => useSiteLogo())
    await waitFor(() => expect(result.current.url).toBe('https://x/sign/logos/new.webp?t=1'))
  })

  it('reports "none" when no logo is configured', async () => {
    settingsState.settings = {}
    const { result } = renderHook(() => useSiteLogo())
    await waitFor(() => expect(result.current.status).toBe('none'))
  })
})
