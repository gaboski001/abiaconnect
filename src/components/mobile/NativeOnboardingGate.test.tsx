import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NativeOnboardingGate } from './NativeOnboardingGate'

const authState = vi.hoisted(() => ({
  user: null as null | { id: string },
  loading: false,
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('./MobileOnboarding', () => ({
  MobileOnboarding: () => <div data-testid="native-onboarding-overlay" />,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <button type="button">Underlying screen action</button>
      <NativeOnboardingGate />
    </MemoryRouter>,
  )
}

describe('NativeOnboardingGate native overlay safety', () => {
  beforeEach(() => {
    localStorage.clear()
    authState.user = null
    authState.loading = false
  })

  it('can show onboarding on the native root screen', async () => {
    renderAt('/')

    expect(await screen.findByTestId('native-onboarding-overlay')).toBeInTheDocument()
  })

  it.each(['/login', '/messages', '/messages/conversation-1', '/thread/thread-1'])(
    'does not cover interactive deep-link route %s',
    (path) => {
      renderAt(path)

      expect(screen.queryByTestId('native-onboarding-overlay')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /underlying screen action/i })).toBeEnabled()
    },
  )
})