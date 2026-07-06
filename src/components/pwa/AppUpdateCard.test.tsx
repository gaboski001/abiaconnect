import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock the update hook so we can drive `hasUpdate` from the test.
const updateState = {
  release: null as null | {
    id: string
    platform: 'android'
    version: string
    file_path: string
    file_size: number | null
    changelog: string | null
    created_at: string
  },
  currentVersion: '1.0.0' as string | null,
  hasUpdate: false,
  platform: 'android' as 'android' | 'ios' | 'web',
  isLoading: false,
  isNative: true,
}
vi.mock('@/hooks/useAppUpdate', () => ({
  useAppUpdate: () => updateState,
}))

// Stub the download hook — the card only reads state/actions from it.
vi.mock('@/hooks/useReleaseDownload', () => ({
  useReleaseDownload: () => ({
    state: { status: 'idle' as const },
    download: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
    installExisting: vi.fn(),
    openInstallSettings: vi.fn(),
    hasCachedInstall: () => false,
  }),
}))

import { AppUpdateCard } from './AppUpdateCard'

const ReleaseFixture = {
  id: 'r1',
  platform: 'android' as const,
  version: '4.0.1',
  file_path: 'android/app-4.0.1.apk',
  file_size: 9_500_000,
  changelog: '- bug fixes',
  created_at: new Date().toISOString(),
}

function renderCard(props: Parameters<typeof AppUpdateCard>[0] = {}) {
  return render(
    <MemoryRouter>
      <AppUpdateCard {...props} />
    </MemoryRouter>,
  )
}

describe('AppUpdateCard', () => {
  beforeEach(() => {
    cleanup()
    updateState.release = null
    updateState.currentVersion = '1.0.0'
    updateState.hasUpdate = false
    updateState.platform = 'android'
    updateState.isLoading = false
    updateState.isNative = true
  })

  it('shows the update banner when a newer release exists', () => {
    updateState.release = ReleaseFixture
    updateState.hasUpdate = true
    renderCard()
    expect(screen.getByText(/Version 4\.0\.1 available/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Update to v4\.0\.1/i })).toBeInTheDocument()
  })

  it('renders nothing on the dashboard once installed version matches latest', () => {
    // After install & relaunch, useAppUpdate re-reads getInfo() and returns
    // hasUpdate=false. The dashboard uses the default (no showWhenUpToDate),
    // so the whole card collapses.
    updateState.release = null
    updateState.hasUpdate = false
    updateState.currentVersion = '4.0.1'
    const { container } = renderCard()
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/Update available/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Version .* available/i)).not.toBeInTheDocument()
  })

  it('renders nothing on the More page once installed version matches latest', () => {
    updateState.release = null
    updateState.hasUpdate = false
    updateState.currentVersion = '4.0.1'
    const { container } = renderCard({ variant: 'plain' })
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/Update available/i)).not.toBeInTheDocument()
  })

  it('clears the banner immediately when hasUpdate flips false on re-render', () => {
    updateState.release = ReleaseFixture
    updateState.hasUpdate = true
    const { rerender, container } = renderCard()
    expect(screen.getByText(/Version 4\.0\.1 available/i)).toBeInTheDocument()

    // Simulate resume/appStateChange refreshing currentVersion to the newly
    // installed APK version — hook now reports no update.
    updateState.release = null
    updateState.hasUpdate = false
    updateState.currentVersion = '4.0.1'
    rerender(
      <MemoryRouter>
        <AppUpdateCard />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
