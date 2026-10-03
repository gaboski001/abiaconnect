import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const settings = { current: {} as Record<string, string> }
const releases = { current: [] as unknown[] }
const toastFn = vi.fn()

vi.mock('@/lib/toast', () => ({ toast: Object.assign((...a: unknown[]) => toastFn(...a), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/hooks/useSiteSettings', () => ({ useSiteSettings: () => ({ settings: settings.current }) }))
vi.mock('@/hooks/useReleaseDownload', () => ({
  useReleaseDownload: () => ({ state: { status: 'idle', progress: null, loaded: 0, total: null }, download: vi.fn(), cancel: vi.fn(), reset: vi.fn() }),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: releases.current, error: null }) }) }),
    }),
  },
}))

import { safeStoreUrl, GooglePlayBadge } from './StoreBadges'
import { NativeAppDownload } from './NativeAppDownload'

const apk = { id: 'r1', platform: 'android', version: '1.0.3', file_path: 'android/a.apk', file_size: 12_000_000, changelog: null, created_at: '2026-10-03' }

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NativeAppDownload />
    </QueryClientProvider>,
  )

describe('store links', () => {
  it('only accepts the official Google Play and Apple store pages', () => {
    expect(safeStoreUrl('https://play.google.com/store/apps/details?id=com.abiaconnect.app', 'play')).toMatch(/^https:\/\/play\.google\.com/)
    expect(safeStoreUrl('https://apps.apple.com/app/abiaconnect/id123', 'apple')).toMatch(/^https:\/\/apps\.apple\.com/)
    for (const bad of ['', '   ', 'http://play.google.com/x', 'https://evil.example/app.apk', 'https://play.google.com.evil.example/', 'javascript:alert(1)']) {
      expect(safeStoreUrl(bad, 'play'), bad).toBeNull()
    }
    expect(safeStoreUrl('https://play.google.com/store/apps/details?id=x', 'apple')).toBeNull()
  })

  it('shows "Coming soon" when there is no link, and tells the member on tap', () => {
    render(<GooglePlayBadge href={null} />)
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Google Play: coming soon/ }))
    expect(toastFn).toHaveBeenCalledWith('Coming soon to Google Play', expect.anything())
  })
})

describe('Get the app card', () => {
  beforeEach(() => toastFn.mockReset())

  it('before the app is on the stores: both badges say Coming soon and the uploaded APK is offered', async () => {
    settings.current = {}
    releases.current = [apk]
    renderCard()
    expect(screen.getAllByText('Coming soon')).toHaveLength(2)
    expect(await screen.findByText('Or download directly')).toBeInTheDocument()
    expect(screen.getByText('Android v1.0.3')).toBeInTheDocument()
  })

  it('once on Google Play: the badge links to the store and the APK is no longer offered', async () => {
    settings.current = { play_store_url: 'https://play.google.com/store/apps/details?id=com.abiaconnect.app' }
    releases.current = [apk]
    renderCard()
    const link = screen.getByRole('link', { name: /Get it on Google Play/ })
    expect(link).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.abiaconnect.app')
    expect(screen.getAllByText('Coming soon')).toHaveLength(1) // App Store still coming soon
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Or download directly')).not.toBeInTheDocument()
  })
})
