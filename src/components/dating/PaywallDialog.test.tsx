import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const platform = vi.hoisted(() => ({ native: false, name: 'web' }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native, getPlatform: () => platform.name },
}))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: null, error: null }) } }))

import { PaywallDialog } from './PaywallDialog'

const renderDialog = () =>
  render(
    <MemoryRouter>
      <PaywallDialog reason="likes_limit" open onOpenChange={() => {}} />
    </MemoryRouter>,
  )

describe('PaywallDialog', () => {
  beforeEach(() => {
    platform.native = false
    platform.name = 'web'
  })

  it('offers an upgrade and an easy way out on the website', () => {
    renderDialog()
    expect(screen.getByText("You've reached today's connection requests")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /explore premium/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue tomorrow/i })).toBeInTheDocument()
  })

  it('shows no purchase option inside the Android app (Google Play policy)', () => {
    platform.native = true
    platform.name = 'android'
    renderDialog()
    expect(screen.queryByRole('button', { name: /explore premium/i })).not.toBeInTheDocument()
    expect(screen.getByText('Membership upgrades are not available in this app.')).toBeInTheDocument()
  })
})
